import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// KC Cobranzas - Auth API Route
// Login con DNI, Email o Celular via Supabase Auth
// Vercel: 100% Supabase (no SQLite, no Prisma)
// Local:  Supabase Auth + SQLite sync
// ============================================================

const isVercel = process.env.VERCEL === '1';

// ============================================================
// Supabase client helper (lazy, no module-level side effects)
// ============================================================
let supabaseModule: typeof import('@supabase/supabase-js') | null = null;

async function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceKey || anonKey;

  if (!url || !key) {
    console.error('[Auth] Missing Supabase env vars. URL:', !!url, 'KEY:', !!key);
    return null;
  }

  if (!supabaseModule) {
    supabaseModule = await import('@supabase/supabase-js');
  }

  return supabaseModule.createClient(url, key);
}

// ============================================================
// POST handler
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'login':
        return await handleLogin(body);
      case 'change-password':
        return await handleChangePassword(body);
      case 'sync-users':
        return await handleSyncUsers();
      case 'sync-data':
        return await handleSyncData();
      default:
        return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Auth API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', detail: String(error) },
      { status: 500 }
    );
  }
}

// ============================================================
// GET handler - check session
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const userId = authHeader?.replace('Bearer ', '');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    // Use Supabase directly (works on both Vercel and local)
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase no configurado' }, { status: 500 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, name, role, phone, dni, is_active')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    const profileRole = profile.role
      || (await supabase.auth.admin.getUserById(profile.id)).data?.user?.user_metadata?.role
      || 'collector';

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profileRole,
        phone: profile.phone,
        documentNumber: profile.dni,
        isActive: profile.is_active ?? true,
      },
    });
  } catch (error) {
    console.error('[Auth API] GET error:', error);
    return NextResponse.json({ success: false, error: 'Error de sesión' }, { status: 500 });
  }
}

// ============================================================
// LOGIN - Always uses Supabase Auth
// ============================================================
async function handleLogin(body: { username: string; password: string }) {
  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json(
      { success: false, error: 'DNI/correo y contraseña son requeridos' },
      { status: 400 }
    );
  }

  const isEmail = username.includes('@');
  // Detect if it's a phone number: starts with 9 and is 9 digits (Peruvian mobile)
  const isPhone = /^9\d{8}$/.test(username);

  // Step 1: If DNI or phone entered, look up email from profiles table
  let emailToTry = username;
  let step1ProfileId: string | null = null;
  if (!isEmail) {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Error de configuración del servidor' },
        { status: 500 }
      );
    }

    // Search by DNI first, then by phone if not found
    let profileLookup: Record<string, unknown> | null = null;
    let lookupError: unknown = null;

    if (isPhone) {
      // Search by phone number
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, dni, phone')
        .eq('phone', username)
        .single();
      profileLookup = data;
      lookupError = error;
      console.log('[Auth] Step 1 - Phone lookup:', { username, data, error: error?.message });
    } else {
      // Search by DNI
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, dni, phone')
        .eq('dni', username)
        .single();
      profileLookup = data;
      lookupError = error;
      console.log('[Auth] Step 1 - DNI lookup:', { username, data, error: error?.message });
    }

    // If not found by the first method, try the other
    if (!profileLookup && !isPhone) {
      // DNI not found, try phone
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, dni, phone')
        .eq('phone', username)
        .single();
      if (data) {
        profileLookup = data;
        lookupError = null;
        console.log('[Auth] Step 1 - Found by phone instead');
      }
    } else if (!profileLookup && isPhone) {
      // Phone not found, try DNI
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, dni, phone')
        .eq('dni', username)
        .single();
      if (data) {
        profileLookup = data;
        lookupError = null;
        console.log('[Auth] Step 1 - Found by DNI instead');
      }
    }

    if (profileLookup?.email) {
      emailToTry = String(profileLookup.email);
      step1ProfileId = String(profileLookup.id || '');
    } else {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado en el sistema' },
        { status: 401 }
      );
    }
  }

  // Step 2: Authenticate with Supabase Auth
  const supabase = await getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Error de configuración del servidor' },
      { status: 500 }
    );
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: emailToTry,
    password,
  });

  if (authError || !authData.user) {
    console.error('[Auth] Supabase auth error:', authError?.message);
    return NextResponse.json(
      { success: false, error: 'Usuario o contraseña incorrectos' },
      { status: 401 }
    );
  }

  // Refresh user data from server to ensure latest app_metadata
  try {
    const { data: { user: refreshedUser } } = await supabase.auth.getUser();
    if (refreshedUser) authData.user = refreshedUser;
  } catch { /* non-critical */ }

  // Step 3: Get profile from Supabase profiles table
  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, name, role, phone, dni, is_active')
    .eq('id', authData.user.id)
    .single();

  console.log('[Auth] Step 3 - Profile by ID:', {
    authUserId: authData.user.id,
    profileFound: !!profile,
    profileRole: profile?.role,
    profileDni: profile?.dni,
    profileError: profileError?.message,
  });

  // Fallback: If profile not found by auth ID, try by email or by step1 profile ID
  if (profileError || !profile) {
    console.log('[Auth] Step 3 fallback - trying by email:', emailToTry);
    const { data: profileByEmail, error: emailError } = await supabase
      .from('profiles')
      .select('id, email, name, role, phone, dni, is_active')
      .eq('email', emailToTry)
      .single();

    console.log('[Auth] Step 3 fallback by email:', {
      profileFound: !!profileByEmail,
      profileRole: profileByEmail?.role,
      profileDni: profileByEmail?.dni,
      emailError: emailError?.message,
    });

    if (profileByEmail) {
      profile = profileByEmail;
      profileError = null;
    }
  }

  // Fallback 2: If still not found and we have step1 profile ID
  if ((!profile || profileError) && step1ProfileId) {
    console.log('[Auth] Step 3 fallback 2 - trying by step1 ID:', step1ProfileId);
    const { data: profileById } = await supabase
      .from('profiles')
      .select('id, email, name, role, phone, dni, is_active')
      .eq('id', step1ProfileId)
      .single();

    if (profileById) {
      profile = profileById;
      profileError = null;
      console.log('[Auth] Step 3 fallback 2 - found profile:', { role: profileById.role, dni: profileById.dni });
    }
  }

  // Fallback 3: Use Supabase Auth Admin API (bypasses RLS, uses /auth/v1/admin/users)
  if (!profile && profileError?.message?.includes('permission denied')) {
    console.log('[Auth] Step 3 fallback 3 - trying Auth Admin API:', authData.user.id);
    try {
      const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (adminUrl && adminKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const adminSupabase = createClient(adminUrl, adminKey, { auth: { persistSession: false } });
        const { data: authUserData, error: authUserErr } = await adminSupabase.auth.admin.getUserById(authData.user.id);
        if (!authUserErr && authUserData?.user) {
          const metaRole = authUserData.user?.app_metadata?.role || authUserData.user?.user_metadata?.role;
          if (metaRole) {
            profile = { id: authData.user.id, email: emailToTry, name: emailToTry.split('@')[0], role: metaRole } as any;
            profileError = null;
            console.log('[Auth] Step 3 fallback 3 - found role in auth metadata:', { role: metaRole });
          }
        }
      }
    } catch (adminErr) {
      console.error('[Auth] Admin API fallback error:', adminErr);
    }
  }
  // Fallback 4: Try Prisma (direct DB via DATABASE_URL, bypasses RLS)
  if (!profile && profileError?.message?.includes('permission denied')) {
    console.log('[Auth] Step 3 fallback 4 - trying Prisma:', authData.user.id);
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      const dbProfile = await prisma.profiles.findUnique({
        where: { id: authData.user.id },
        select: { id: true, email: true, name: true, role: true, phone: true, dni: true, isActive: true },
      });
      await prisma.$disconnect();
      if (dbProfile) {
        profile = {
          id: dbProfile.id,
          email: dbProfile.email,
          name: dbProfile.name,
          role: dbProfile.role,
          phone: dbProfile.phone,
          dni: dbProfile.dni,
          isActive: dbProfile.isActive,
        };
        profileError = null;
        console.log('[Auth] Step 3 fallback 4 - found via Prisma:', { role: dbProfile.role });
      }
    } catch (prismaErr) {
      console.error('[Auth] Prisma fallback error:', prismaErr);
    }
  }

  if (profileError) {
    console.error('[Auth] Profile fetch error (all attempts):', profileError.message);
  }

  // Determine role with fallback chain:
  // 1. From profiles table (role column)
  // 2. From auth user_metadata (set by Flutter app)
  // 3. From auth app_metadata
  // 4. Default to 'collector'
  const userRole = profile?.role
    || authData.user?.user_metadata?.role
    || authData.user?.app_metadata?.role
    || 'collector';

  console.log('[Auth] Role resolution:', {
    profileRole: profile?.role,
    userMetaRole: authData.user?.user_metadata?.role,
    appMetaRole: authData.user?.app_metadata?.role,
    finalRole: userRole,
  });

  const user = {
    id: authData.user.id,
    email: profile?.email || authData.user.email || emailToTry,
    name: profile?.name || authData.user.user_metadata?.name || emailToTry.split('@')[0],
    role: userRole,
    phone: profile?.phone || null,
    documentNumber: profile?.dni || null,
    isActive: profile?.is_active ?? true,
  };

  console.log('[Auth] Final user object:', { id: user.id, name: user.name, role: user.role, dni: user.documentNumber });

  // Step 4: On local, sync to SQLite in background (non-blocking)
  if (!isVercel) {
    syncToLocalDB(user, password).catch(() => { });
    syncFromSupabaseBackground().catch(() => { });
  }

  return NextResponse.json({ success: true, user });
}

// ============================================================
// CHANGE PASSWORD
// ============================================================
async function handleChangePassword(body: { userId: string; currentPassword: string; newPassword: string }) {
  const { userId, currentPassword, newPassword } = body;

  if (!userId || !currentPassword || !newPassword) {
    return NextResponse.json(
      { success: false, error: 'Todos los campos son requeridos' },
      { status: 400 }
    );
  }

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Supabase no configurado' },
        { status: 500 }
      );
    }

    const { error } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) {
      return NextResponse.json(
        { success: false, error: 'Error al actualizar contraseña en Supabase' },
        { status: 500 }
      );
    }

    // Update local SQLite if available
    if (!isVercel) {
      try {
        const { db } = await import('@/lib/db');
        const user = await db.profile.findUnique({ where: { id: userId } });
        if (user && user.password === currentPassword) {
          await db.profile.update({
            where: { id: userId },
            data: { password: newPassword },
          });
        }
      } catch { /* non-critical */ }
    }

    return NextResponse.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error al actualizar contraseña' },
      { status: 500 }
    );
  }
}

// ============================================================
// SYNC USERS - Pull all profiles from Supabase
// ============================================================
async function handleSyncUsers() {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Supabase no configurado' },
        { status: 400 }
      );
    }

    const { data: profiles, error } = await supabase.from('profiles').select('*');

    if (error || !profiles) {
      return NextResponse.json(
        { success: false, error: 'Error al sincronizar desde Supabase' },
        { status: 500 }
      );
    }

    // On Vercel: just return the count
    if (isVercel) {
      return NextResponse.json({
        success: true,
        message: `${profiles.length} usuarios disponibles en Supabase`,
        synced: profiles.length,
      });
    }

    // Locally: sync to SQLite
    const { db } = await import('@/lib/db');
    let synced = 0;
    for (const profile of profiles) {
      try {
        const profileRole = profile.role || 'collector';
        await db.profile.upsert({
          where: { id: profile.id },
          update: {
            email: profile.email,
            name: profile.name,
            role: profileRole,
            phone: profile.phone,
            documentNumber: profile.dni,
            isActive: profile.is_active ?? true,
          },
          create: {
            id: profile.id,
            email: profile.email,
            name: profile.name || profile.email.split('@')[0],
            role: profileRole,
            phone: profile.phone,
            documentNumber: profile.dni,
            password: 'synced_from_supabase',
            isActive: profile.is_active ?? true,
          },
        });
        synced++;
      } catch { /* skip */ }
    }

    return NextResponse.json({
      success: true,
      message: `${synced} usuarios sincronizados`,
      synced,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error al sincronizar' },
      { status: 500 }
    );
  }
}

// ============================================================
// SYNC DATA
// ============================================================
async function handleSyncData() {
  try {
    if (isVercel) {
      return NextResponse.json({
        success: true,
        message: 'Usando Supabase directamente - no se necesita sync',
      });
    }

    await syncFromSupabaseBackground();
    return NextResponse.json({
      success: true,
      message: 'Datos sincronizados desde Supabase',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error al sincronizar datos' },
      { status: 500 }
    );
  }
}

// ============================================================
// Local-only: Sync user to SQLite
// ============================================================
async function syncToLocalDB(
  user: { id: string; email: string; name: string; role: string; phone: string | null; documentNumber: string | null },
  password: string
) {
  try {
    const { db } = await import('@/lib/db');
    await db.profile.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        name: user.name,
        role: user.role as 'admin' | 'supervisor' | 'collector',
        phone: user.phone,
        documentNumber: user.documentNumber,
        password,
        isActive: true,
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        role: user.role as 'admin' | 'supervisor' | 'collector',
        phone: user.phone,
        documentNumber: user.documentNumber,
        password,
        isActive: true,
      },
    });
  } catch (err) {
    console.error('[Auth] Local sync error:', err);
  }
}

// ============================================================
// Local-only: Background sync from Supabase (zones + profiles)
// ============================================================
async function syncFromSupabaseBackground() {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return;

    const { db } = await import('@/lib/db');

    // Sync ZONES
    const { data: zones } = await supabase.from('zones').select('*');
    if (zones && zones.length > 0) {
      for (const zone of zones) {
        try {
          await db.zone.upsert({
            where: { id: zone.id },
            update: { name: zone.name },
            create: { id: zone.id, name: zone.name },
          });
        } catch { /* skip */ }
      }
    }

    // Sync PROFILES
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        try {
          const profileRole = profile.role || 'collector';
          await db.profile.upsert({
            where: { id: profile.id },
            update: {
              email: profile.email,
              name: profile.name,
              role: profileRole,
              phone: profile.phone,
              documentNumber: profile.dni,
              isActive: profile.is_active ?? true,
            },
            create: {
              id: profile.id,
              email: profile.email,
              name: profile.name || profile.email.split('@')[0],
              role: profileRole,
              phone: profile.phone,
              documentNumber: profile.dni,
              password: 'synced_from_supabase',
              isActive: profile.is_active ?? true,
            },
          });
        } catch { /* skip */ }
      }
    }
  } catch (err) {
    console.error('[Auth] Background sync error:', err);
  }
}