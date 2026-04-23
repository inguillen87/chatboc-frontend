import re

with open('src/components/tickets/inbox/TicketConversationPane.tsx', 'r') as f:
    content = f.read()

# Make the placeholders render the new components we just made to connect them up.
imports = """import { PresenceAvatars } from './PresenceAvatars';
import { AssignmentWidget } from './AssignmentWidget';
import { TimelineMergeView } from './TimelineMergeView';
import { TypingIndicator } from './TypingIndicator';
import { TicketTimelineEvent } from '@/schemas/api';
"""

content = content.replace("import React from 'react';", "import React from 'react';\n" + imports)

# Fill in placeholders with mock props to make sure it compiles
patch_presence = """<PresenceAvatars users={[{id: 'u1', name: 'Admin', type: 'agent', status: 'online'}, {id: 'u2', name: 'Vecino', type: 'user', status: 'idle'}]} />"""
content = content.replace("{/* Placeholder for PresenceAvatars */}", patch_presence)

patch_assignment = """<AssignmentWidget availableAgents={[{id: 'a1', name: 'Juan Perez', email: 'jperez@ejemplo.com'}]} onAssign={() => {}} />"""
content = content.replace("{/* Placeholder for AssignmentWidget */}", patch_assignment)

patch_timeline = """<TimelineMergeView events={[{id: 'ev1', ticket_id: ticketId, type: 'status_changed', timestamp: new Date().toISOString(), actor: {id: 'sys', type: 'system', name: 'Sistema'}, payload: {new_status: 'en_proceso'}} as TicketTimelineEvent]} />"""
content = content.replace("{/* Placeholder for TimelineMergeView */}", patch_timeline)

patch_typing = """<TypingIndicator usersTyping={[{id: 'u2', name: 'Vecino'}]} />"""
content = content.replace("{/* Placeholder for TypingIndicator */}", patch_typing)


with open('src/components/tickets/inbox/TicketConversationPane.tsx', 'w') as f:
    f.write(content)
