'use client'

import {
  useAuthenticationStatus,
  useSignOut,
  useUserData,
  useAccessToken,
} from '@nhost/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

// SVG Icon Components
const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
)

const PaperAirplaneIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
)

const ChatBubbleLeftIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
)

const UserCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const ArrowRightOnRectangleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
)

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 21a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM19 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zM19 21a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" />
  </svg>
)

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

interface Message {
  id?: string
  sender: 'user' | 'bot'
  text: string
  timestamp?: string
}

interface Chat {
  id: string
  title: string
  created_at: string
}

export default function ChatbotPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuthenticationStatus()
  const { signOut } = useSignOut()
  const user = useUserData()
  const accessToken = useAccessToken()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [mounted, setMounted] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [currentChat, setCurrentChat] = useState<Chat | null>(null)
  const [chatHistory, setChatHistory] = useState<Chat[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const HASURA_GRAPHQL_URL =
    'https://yqvruonisddhfyefbrry.hasura.ap-south-1.nhost.run/v1/graphql'

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  // Load chat history
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadChatHistory()
    }
  }, [isAuthenticated, user])

  const loadChatHistory = async () => {
    try {
      const response = await fetch(HASURA_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : { 'x-hasura-admin-secret': `T3$vYfSkIjRCzJjhg9'v'rG_9W'gtcQ+` }),
        },
        body: JSON.stringify({
          query: `
            query GetUserChats($userId: uuid!) {
              chats(
                where: { user_id: { _eq: $userId } }, 
                order_by: { created_at: desc }
              ) {
                id
                title
                created_at
              }
            }
          `,
          variables: { userId: user?.id },
        }),
      })

      const data = await response.json()
      if (data.data?.chats) {
        setChatHistory(data.data.chats)
        // Load the most recent chat if available
        if (data.data.chats.length > 0 && !currentChat) {
          loadChatMessages(data.data.chats[0])
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
    }
  }

  const loadChatMessages = async (chat: Chat) => {
    setCurrentChat(chat)
    try {
      const response = await fetch(HASURA_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : { 'x-hasura-admin-secret': `T3$vYfSkIjRCzJjhg9'v'rG_9W'gtcQ+` }),
        },
        body: JSON.stringify({
          query: `
            query GetChatMessages($chatId: uuid!) {
              messages(
                where: { chat_id: { _eq: $chatId } },
                order_by: { created_at: asc }
              ) {
                id
                content
                role
                created_at
              }
            }
          `,
          variables: { chatId: chat.id },
        }),
      })

      const data = await response.json()
      if (data.data?.messages) {
        const formattedMessages = data.data.messages.map((msg: any) => ({
          id: msg.id,
          sender: msg.role === 'user' ? 'user' : 'bot',
          text: msg.content,
          timestamp: msg.created_at,
        }))
        setMessages(formattedMessages)
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const startNewChat = () => {
    setCurrentChat(null)
    setMessages([])
  }

  const saveMessage = async (chatId: string, content: string, role: 'user' | 'assistant') => {
    try {
      await fetch(HASURA_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : { 'x-hasura-admin-secret': `T3$vYfSkIjRCzJjhg9'v'rG_9W'gtcQ+` }),
        },
        body: JSON.stringify({
          query: `
            mutation InsertMessage($chatId: uuid!, $content: String!, $role: String!) {
              insert_messages_one(object: { 
                chat_id: $chatId, 
                content: $content, 
                role: $role 
              }) {
                id
              }
            }
          `,
          variables: { chatId, content, role },
        }),
      })
    } catch (error) {
      console.error('Error saving message:', error)
    }
  }

  if (!mounted) return null
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your chatbot...</p>
        </div>
      </div>
    )
  }
  if (!isAuthenticated) return null

  const handleSend = async () => {
    if (!input.trim() || isTyping) return

    const currentMessage = input.trim()
    const userMessage = { sender: 'user' as const, text: currentMessage }
    
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    try {
      let chatId = currentChat?.id

      // Create new chat if none exists
      if (!chatId) {
        const title = currentMessage.length > 30 
          ? currentMessage.substring(0, 30) + '...' 
          : currentMessage
        
        const createChatRes = await fetch(HASURA_GRAPHQL_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : { 'x-hasura-admin-secret': `T3$vYfSkIjRCzJjhg9'v'rG_9W'gtcQ+` }),
          },
          body: JSON.stringify({
            query: `
              mutation CreateChat($userId: uuid!, $title: String!) {
                insert_chats_one(object: { user_id: $userId, title: $title }) {
                  id
                  title
                  created_at
                }
              }
            `,
            variables: { userId: user?.id, title },
          }),
        })

        const createChatData = await createChatRes.json()
        if (createChatData.data?.insert_chats_one) {
          const newChat = createChatData.data.insert_chats_one
          chatId = newChat.id
          setCurrentChat(newChat)
          setChatHistory(prev => [newChat, ...prev])
        }
      }

      // Save user message to database
      if (chatId) {
        await saveMessage(chatId, currentMessage, 'user')
      }

      // Call local API proxy (which calls n8n webhook)
      const response = await fetch('https://n8n-chatbot-9evz.onrender.com/webhook/sendMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentMessage
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error('Failed to get response from bot')
      }

      // Extract response from n8n webhook format
      const botReply = data[0]?.text || data?.response || 'Sorry, I could not process your request.'
      const botMessage = { sender: 'bot' as const, text: botReply }
      
      setMessages((prev) => [...prev, botMessage])

      // Save bot message to database
      if (chatId) {
        await saveMessage(chatId, botReply, 'assistant')
      }

    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = { 
        sender: 'bot' as const, 
        text: 'Sorry, I encountered an error. Please try again.' 
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col shadow-lg overflow-hidden`}>
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-600">
          <button
            onClick={startNewChat}
            className="w-full bg-white text-blue-600 py-3 px-4 rounded-xl hover:bg-blue-50 transition-all duration-200 flex items-center justify-center space-x-2 font-medium shadow-sm"
          >
            <PlusIcon className="w-5 h-5" />
            <span>New Chat</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-4 flex items-center">
              <ClockIcon className="w-4 h-4 mr-2" />
              Recent Conversations
            </h3>
            <div className="space-y-2">
              {chatHistory.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => loadChatMessages(chat)}
                  className={`w-full text-left p-4 rounded-xl transition-all duration-200 group ${
                    currentChat?.id === chat.id
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-sm'
                      : 'hover:bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <ChatBubbleLeftIcon className={`w-5 h-5 mt-0.5 ${
                      currentChat?.id === chat.id ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate mb-1">
                        {chat.title}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(chat.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center shadow-md">
                <UserCircleIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {user?.displayName || user?.email?.split('@')[0]}
                </div>
                <div className="text-xs text-gray-500">{user?.email}</div>
              </div>
            </div>
            <button 
              onClick={() => signOut()}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
              title="Sign out"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChatBubbleLeftIcon className="w-6 h-6 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {currentChat?.title || 'New Conversation'}
                </h1>
                <p className="text-sm text-gray-500 flex items-center">
                  <SparklesIcon className="w-4 h-4 mr-1" />
                  AI Assistant
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center mt-20">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <SparklesIcon className="w-12 h-12 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Welcome to AI Chat
              </h2>
              <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
                Start a conversation with your AI assistant. Ask questions, get help, or just chat!
              </p>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                {[
                  "Help me write an email",
                  "Explain a complex topic",
                  "Brainstorm some ideas"
                ].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(suggestion)}
                    className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 text-sm text-gray-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-end space-x-3 max-w-[75%] ${msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.sender === 'user' 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500' 
                    : 'bg-gradient-to-r from-gray-100 to-gray-200'
                }`}>
                  {msg.sender === 'user' ? (
                    <UserCircleIcon className="w-5 h-5 text-white" />
                  ) : (
                    <SparklesIcon className="w-5 h-5 text-gray-600" />
                  )}
                </div>
                <div
                  className={`p-4 rounded-2xl shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
                  }`}
                >
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.text}
                  </div>
                  {msg.timestamp && (
                    <div className={`text-xs mt-2 ${
                      msg.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {formatTime(msg.timestamp)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-end space-x-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center">
                  <SparklesIcon className="w-5 h-5 text-gray-600" />
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-6">
          <div className="flex space-x-4 items-end">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full border border-gray-300 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none shadow-sm text-gray-900 placeholder-gray-500"
                placeholder="Type your message here..."
                rows={1}
                disabled={isTyping}
                style={{
                  minHeight: '56px',
                  maxHeight: '120px',
                  resize: 'none'
                }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-4 rounded-2xl hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
            >
              {isTyping ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <PaperAirplaneIcon className="w-5 h-5" />
              )}
            </button>
          </div>
          <div className="mt-3 text-center">
            <p className="text-xs text-gray-500">
              Press Enter to send, Shift + Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}