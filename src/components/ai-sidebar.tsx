'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Settings, BarChart3, DollarSign, 
         Users, Calendar, HelpCircle, Lightbulb, Send, X, 
         Loader2, Check, AlertCircle, Activity, TrendingUp } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  type?: 'help' | 'analysis' | 'tip' | 'error';
}

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  action: () => void;
}

export default function AISidebar({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (v: boolean) => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: '¡Hola! Soy tu asistente de dashboard. ¿En qué puedo ayudarte hoy?\n\n• Analizar tus métricas de cobranzas\n• Sugerir mejoras en gráficos\n• Explicar tendencias\n• Encontrar oportunidades ocultas\n• Optimizar tus paneles',
      sender: 'ai',
      timestamp: new Date(),
      type: 'help'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickActions: QuickAction[] = [
    { 
      label: 'Análisis de Cobranzas', 
      icon: <BarChart3 className="h-4 w-4" />, 
      action: () => setInputValue('¿Puedes analizar mis métricas de cobranzas y sugerir mejoras?') 
    },
    { 
      label: 'Optimizar Pagos', 
      icon: <DollarSign className="h-4 w-4" />, 
      action: () => setInputValue('¿Cómo puedo optimizar mis paneles de pago para mejor performance?') 
    },
    { 
      label: 'Dossiers de Clientes', 
      icon: <Users className="h-4 w-4" />, 
      action: () => setInputValue('Creame un dashboard que muestre el historial completo de clientes, pagos y comportamiento') 
    },
    { 
      label: 'Riesgo ML Predictivo', 
      icon: <AlertCircle className="h-4 w-4" />, 
      action: () => setInputValue('Qué factores predecirían que un cliente entrará en mora?') 
    },
    { 
      label: 'Configuración Auto', 
      icon: <Settings className="h-4 w-4" />, 
      action: () => setInputValue('Optimiza las queries del dashboard para mejor performance') 
    },
    { 
      label: 'Mejorar IA', 
      icon: <Lightbulb className="h-4 w-4" />, 
      action: () => setInputValue('Sugiere mejoras en el dashboard usando mis datos reales') 
    }
  ];

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Simular respuesta de IA
    setTimeout(() => {
      const aiResponse = generateAIResponse(inputValue);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date(),
        type: 'analysis'
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const generateAIResponse = (input: string): string => {
    const lower = input.toLowerCase();
    
    if (lower.includes('cobranza')) {
      return `📊 **Análisis de Cobranzas:**

**Estado Actual:**
• Total Cobrado: S/100.00
• Tasa de Éxito: 100%
• Sin Cuotas en Mora
• Último Pago: Hace 16 días

**Recomendaciones:**
✨ \`Continuar con estrategia actual\`
📈 \`Considerar programa de pagos automáticos\`
👥 \`Contactar clientes por mensaje ante atrasos de 10+ días\`

**Genera Tendencias:** ⬆️ 15% de crecimiento mensual`;
    } else if (lower.includes('dashboard')) {
      return `🎯 **Dashboard Premium Sugerido:**

🏆 **Cards Premium**
• Métricas en tiempo real con shimmer effects
• Avatars animados con glow/pulse
• Hover lifts elegantes
• Gradient text para métricas clave

📊 **Visualizaciones Avanzadas**
• Mini gráficos de tendencias
• Tabs para diferentes vistas (Diario/Semanal/Mensual)
• Filtros en time-range
• Exportación CSV/PDF profesional

🎨 **Experiencia de Usuario**
• Efectos glass-morphism en todo el sitio
• Animaciones fluidas con Framer Motion
• Micro-interactions en interacciones
• Legacy modern UI con dark mode completo

🔧 **Tecnología**
• Framer Motion para motion design
• GSAP para animaciones complejas
• CSS custom properties para focus states
• Backend API con banner de estado elegante
• Email verification con UI cases completas

🎯 **Características**
• Optimizado para desktop y dispositivos móviles (responsivo)
• Error boundaries con UX para Recovery
• Diseño accesible WCAG AA 
• Landing page auto-optimizing
• Performance soberana en todos los dispositivos`;
    } else if (lower.includes('login')) {
      return `🔐 **Portal de Login Premium:**

✨ **Features:**
• Efecto 3D tilt automáticamente en desktop (con mouse) y móvil (con gyroscope)
• Rotación binocular 3D para mobile/tablet
• Imagen animada de avatar con gestos
• Dark mode con tokens de color personalizados
• Starfield canvas visible que brilla a través de paneles transparentes
• Fondo glass-morphosis elegante con blur progresivo
• Logo con efecto shimmer
• Glare effect en cards

🔧 **Tecnología**
• Framer Motion para motion design
• GSAP para animaciones complejas
• CSS custom properties para focus states
• Backend API con banner de estado elegante
• Email verification con UI cases completas

🎯 **Características**
• Optimizado para desktop y dispositivos móviles (responsivo)
• Error boundaries con UX para Recovery
• Diseño accesible WCAG AA 
• Landing page auto-optimizing
• Performance soberana en todos los dispositivos`;
    } else {
      return `🤖 **Análisis IA - Respuesta Detallada:**

**Interpretación de tu consulta:**
"${input}"

**Análisis de Datos:**
• Tus datos actuales: S/100.00 total
• Performance: Excellent (100% success)
• Trending: ⬆️ 15% mensual
• Consolidado: S/100.00

**Análisis de Datos:**
• Patrón consistente de pago: 16 días
• Sin moras detectadas: 0
• Sin riesgo actual
• Tendencia de salud: Estable

**Sugerencias:**
📈 \`Incrementar límites con clientes consistentes \`
💰 \`Implementar sistema pago recurrente\`
👥 \`Recompensar puntualidad\`
📱 \`Push notifications para reminders\`

**Próximos Pasos:** Analizar tendencias futuras predichivas`;
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Smart suggestions based on inactivity
  useEffect(() => {
    const handleActivity = () => {
      // Could trigger smart prompts after inactivity
    };

    document.addEventListener('click', handleActivity);
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('scroll', handleActivity);

    return () => {
      document.removeEventListener('click', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('scroll', handleActivity);
    };
  }, []);

  return (
    <>
      {/* Floating AI Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-2xl hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-110 group"
        aria-label={isOpen ? 'Cerrar Asistente IA' : 'Abrir Asistente IA'}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </button>

      {/* AI Assistant Panel */}
      <div className={`fixed bottom-20 right-6 z-50 w-96 h-[600px] bg-white dark:bg-[#05060b]/95 backdrop-blur-2xl border border-emerald-500/20 rounded-2xl shadow-2xl transition-all duration-300 ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-64 opacity-0 pointer-events-none'}`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-emerald-500/10 bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Asistente IA</h3>
                <p className="text-xs text-emerald-600">Siempre aquí para ayudarte</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-4 border-b border-emerald-500/10">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">ACCIONES RÁPIDAS</p>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => action.action()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors text-left"
                >
                  {action.icon}
                  <span className="text-xs">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[80%]">
                  <div className={`px-4 py-3 rounded-2xl text-sm ${
                    message.sender === 'user'
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-900 dark:text-emerald-100 rounded-tr-lg'
                      : 'bg-slate-100 dark:bg-[#05060b]/60 text-slate-900 dark:text-slate-100 rounded-tl-lg border border-emerald-500/10'
                  }`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <p className={`text-xs mt-1 px-2 ${message.sender === 'user' ? 'text-right text-emerald-500' : 'text-slate-400'}`}>
                    {message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-[#05060b]/60 border border-emerald-500/10">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-emerald-500/10 bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Pregunta sobre tus datos o solicita ayuda..."
                className="flex-1 px-4 py-2 rounded-full border border-emerald-500/20 bg-white dark:bg-[#05060b]/80 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:shadow-lg disabled:opacity-50 transition-all"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="text-xs text-slate-400 mt-2 text-center">
              IA puede convertir datos en insights o explicar cualquier métrica
            </p>
          </div>
        </div>
      </div>
    </>
  );
}