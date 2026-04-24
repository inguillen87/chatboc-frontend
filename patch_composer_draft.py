import re

with open('src/components/tickets/inbox/TicketConversationPane.tsx', 'r') as f:
    content = f.read()

# Add Agent assist components
imports = """import { AgentSuggestionBox } from '../agent-assist/AgentSuggestionBox';
import { AgentSummaryPanel } from '../agent-assist/AgentSummaryPanel';
"""

content = content.replace("import { Textarea } from '@/components/ui/textarea';", "import { Textarea } from '@/components/ui/textarea';\n" + imports)

# We want to render AgentSummaryPanel at the top of the timeline or inside a right drawer usually.
# For now, put it above TimelineMergeView
patch_summary = """
      {/* Agent Assist Summary */}
      <AgentSummaryPanel
         isLoading={false}
         summary="El ciudadano reportó una luminaria rota en San Martin 123 el jueves. Solicita saber cuándo pasará el equipo técnico."
         nextSteps={['Asignar a Cuadrilla Norte', 'Solicitar foto del poste']}
      />
"""
content = content.replace("{/* Timeline/Conversation Area */}", "{/* Timeline/Conversation Area */}\n" + patch_summary)

# Update Composer Area to include Draft button and SuggestionBox
patch_composer = """
      {/* Composer Area */}
      <div className="p-3 border-t bg-background shrink-0 flex flex-col gap-2">
         {/* Placeholder for AgentSuggestionBox */}
         <AgentSuggestionBox
            suggestion="Hola. Hemos recibido tu reporte de la luminaria. Enviaremos a la cuadrilla de la Zona Norte en las próximas 48hs."
            onAccept={() => {}}
            onReject={() => {}}
         />

         {/* Placeholder for TypingIndicator */}
         <TypingIndicator usersTyping={[{id: 'u2', name: 'Vecino'}]} />

         <div className="flex flex-col gap-2">
            <Textarea
              placeholder="Escribe una respuesta..."
              className="min-h-[80px] resize-none text-sm"
            />
            <div className="flex items-center justify-end gap-2">
               <Button variant="outline" size="sm" className="h-8">Guardar borrador</Button>
               <Button size="sm" className="h-8 gap-1.5">
                  Enviar mensaje <Send className="w-3.5 h-3.5" />
               </Button>
            </div>
         </div>
      </div>
"""

content = re.sub(
    r'\{\/\* Composer Area \*\/\}\s*<div className="p-3 border-t bg-background shrink-0">.*?</div>\s*</div>',
    patch_composer.strip() + "\n    </div>",
    content,
    flags=re.DOTALL
)

with open('src/components/tickets/inbox/TicketConversationPane.tsx', 'w') as f:
    f.write(content)
