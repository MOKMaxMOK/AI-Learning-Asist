import { ChatHeader } from '@/components/chat-header'
import { MessageList } from '@/components/message-list'
import { ChatInput } from '@/components/chat-input'

export default function HomePage() {
  return (
    <>
      <ChatHeader />
      <MessageList />
      <ChatInput />
    </>
  )
}
