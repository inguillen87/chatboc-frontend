import re

with open('src/components/chat/ChatPanel.tsx', 'r') as f:
    content = f.read()

# Buscamos donde renderiza {messages.map...} para envolverlo en el Empty State si messages.length === 0
empty_state_jsx = """
        {messages.length === 0 ? (
             <div className="flex-1 flex flex-col justify-center items-center text-center p-6 mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
                   <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold mb-2">¿En qué podemos ayudarte?</h3>
                <p className="text-sm text-muted-foreground mb-8 max-w-[260px]">
                   Escribí tu consulta abajo o usá las opciones del menú.
                </p>
             </div>
        ) : (
          <>
            {messages.map((msg) => (
"""

if "¿En qué podemos ayudarte?" not in content:
    # 1. Importar icono si no está
    if "MessageSquare" not in content:
        content = content.replace('import { X, CheckCircle2, Lightbulb } from "lucide-react";', 'import { X, CheckCircle2, Lightbulb, MessageSquare } from "lucide-react";')

    # 2. Reemplazar
    content = content.replace("{messages.map((msg) => (", empty_state_jsx)
    content = content.replace("logoBadgeStyle={logoBadgeStyle}\n          />\n        ))}", "logoBadgeStyle={logoBadgeStyle}\n          />\n        ))}\n          </>\n        )}")

with open('src/components/chat/ChatPanel.tsx', 'w') as f:
    f.write(content)
