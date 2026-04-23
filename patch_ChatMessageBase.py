import re

with open('src/components/chat/ChatMessageBase.tsx', 'r') as f:
    content = f.read()

# Import the new components
imports = """import { ChatStreamRenderer, PolicyBanner } from './stream';
"""
content = content.replace("import sanitizeMessageHtml", imports + "import sanitizeMessageHtml")

# In ChatMessageBase, we have logic for rendering the message text
# Find where it renders `sanitizedHtml` or `msg.texto` and replace it with ChatStreamRenderer for incoming assistant messages.
# If `msg.isStreaming` is true, we pass the streamSource? Actually, right now ChatMessageBase just gets static strings.
# But Epic FE-C says we should use ChatStreamRenderer.
# Let's replace the raw HTML rendering with ChatStreamRenderer for bot messages so that Markdown and citations work.

patch = """
          {msg.isBot && !msg.structuredContent ? (
            <div className="text-sm">
               <PolicyBanner decision={(msg as any).policyDecision} />
               <ChatStreamRenderer streamSource={msg.texto} />
            </div>
          ) : (
            <span
              className={cn("text-[15px] leading-relaxed break-words relative", "font-sans-secondary")}
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          )}
"""

content = re.sub(
    r'<span\s+className=\{cn\("text-\[15px\] leading-relaxed break-words relative", "font-sans-secondary"\)\}\s+dangerouslySetInnerHTML=\{\{\s*__html:\s*sanitizedHtml\s*\}\}\s*/>',
    patch.strip(),
    content
)

with open('src/components/chat/ChatMessageBase.tsx', 'w') as f:
    f.write(content)
