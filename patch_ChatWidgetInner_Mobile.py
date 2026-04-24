import re

with open('src/components/chat/ChatWidgetInner.tsx', 'r') as f:
    content = f.read()

content = re.sub(
    r'const \[view, setView\] = useState<"chat" \| "register" \| "login" \| "user" \| "info">\(initialView\);',
    r'const [view, setView] = useState<"chat" | "register" | "login" | "user" | "info" | "mobile-ticket">(initialView);',
    content
)

imports = """import { MobileTicketForm } from '@/components/widget/MobileTicketForm';
"""

if "import { MobileTicketForm }" not in content:
    content = content.replace("import React,", imports + "import React,")

render_block = """
                    : view === "user" ? <ChatUserPanel onShowLogin={() => setView("login")} entityToken={resolvedOwnerToken ?? undefined} />
                    : view === "mobile-ticket" ? <MobileTicketForm onClose={() => setView("chat")} onSubmit={(data) => console.log('Ticket submitted', data)} />
                    : <ChatPanel
"""
content = content.replace(': view === "user" ? <ChatUserPanel onShowLogin={() => setView("login")} entityToken={resolvedOwnerToken ?? undefined} />\n                    : <ChatPanel', render_block)

with open('src/components/chat/ChatWidgetInner.tsx', 'w') as f:
    f.write(content)
