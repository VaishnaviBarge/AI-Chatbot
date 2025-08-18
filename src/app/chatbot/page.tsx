'use client'

import {useAuthenticationStatus, useSignOut, useUserData, useAccessToken} from '@nhost/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Plus, Send, MessageCircle, UserCircle, LogOut, Sparkles, Clock, Menu, X } from 'lucide-react'

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

interface HasuraMessage {
  id: string
  content: string
  role?: string
  created_at: string
  chat_id: string
  user_id: string
}

interface HasuraError {
  message: string
}

interface HasuraResponse {
  data?: {
    messages?: HasuraMessage[]
    chats?: Chat[]
    insert_chats_one?: Chat
  }
  errors?: HasuraError[]
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
  const [sidebarOpen, setSidebarOpen] = useState(false) // Changed default to false for mobile-first

  // Environment variables
  const HASURA_GRAPHQL_URL = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!
  const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET!
  const N8N_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL!

  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Set sidebar open by default on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }

    // Set initial state
    handleResize()
    
    // Add event listener
    window.addEventListener('resize', handleResize)
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize)
  }, [])
 
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  const loadChatHistory = useCallback(async () => {
    try {
      const response = await fetch(HASURA_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : { 'x-hasura-admin-secret': HASURA_ADMIN_SECRET }),
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

      const data: HasuraResponse = await response.json()

      
      if (data.data?.chats) {
        setChatHistory(data.data.chats)
        // Don't automatically load any chat - user should start fresh
        // User can manually select a chat from history if needed
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
    }
  }, [accessToken, user?.id, HASURA_GRAPHQL_URL, HASURA_ADMIN_SECRET])

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadChatHistory()
      // Ensure user starts with a clean new chat
      startNewChat()
    }
  }, [isAuthenticated, user?.id, loadChatHistory])

  const loadChatMessages = async (chat: Chat) => {
    setCurrentChat(chat)
    // Close sidebar on mobile when selecting a chat
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    try {
      // Try to get messages with role field first
      const response = await fetch(HASURA_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : { 'x-hasura-admin-secret': HASURA_ADMIN_SECRET }),
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
                chat_id
                user_id
              }
            }
          `,
          variables: { chatId: chat.id },
        }),
      })
      
      const data: HasuraResponse = await response.json()
      
      // If role field is accessible, use it
      if (!data.errors && data.data?.messages) {
        const formattedMessages = data.data.messages.map((msg: HasuraMessage) => ({
          id: msg.id,
          sender: msg.role === 'user' ? 'user' as const : 'bot' as const,
          text: msg.content,
          timestamp: msg.created_at,
        }))
        setMessages(formattedMessages)
        return;
      }
      
      // If role field is not accessible, try without it
      if (data.errors && data.errors.some((err: HasuraError) => err.message.includes('role'))) {
        
        const simpleResponse = await fetch(HASURA_GRAPHQL_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : { 'x-hasura-admin-secret': HASURA_ADMIN_SECRET }),
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
                  created_at
                  chat_id
                  user_id
                }
              }
            `,
            variables: { chatId: chat.id },
          }),
        })
        
        const simpleData: HasuraResponse = await simpleResponse.json()
        
        if (simpleData.data?.messages) {
          // Enhanced logic to determine message sender when role field is not available
          const formattedMessages = simpleData.data.messages.map((msg: HasuraMessage, index: number) => {
            let sender: 'user' | 'bot' = 'user';
            
            // Method 1: Alternating pattern (most reliable for chat apps)
            sender = index % 2 === 0 ? 'user' : 'bot';
            
            // Method 2: Pattern recognition based on content (additional validation)
            const content = msg.content.toLowerCase();
            const botIndicators = [
              'i am', 'as an ai', 'i can help', 'here is', 'here are',
              'based on', 'according to', 'i understand', 'let me',
              'i apologize', 'sorry', 'i think', 'my recommendation',
              'i suggest', 'from my', 'in my', 'here\'s what'
            ];
            
            const userIndicators = [
              'help me', 'can you', 'please', 'what is', 'how do',
              'i need', 'i want', 'tell me', 'explain', 'show me'
            ];
            
            
            if (botIndicators.some(indicator => content.includes(indicator))) {
              sender = 'bot';
            }
    
            else if (userIndicators.some(indicator => content.includes(indicator))) {
              sender = 'user';
            }
            
            return {
              id: msg.id,
              sender,
              text: msg.content,
              timestamp: msg.created_at,
            };
          });
          
          setMessages(formattedMessages);
        }
      }
    } catch (error) {
      console.error('Error loading chat messages:', error)
    }
  }

  const startNewChat = () => {
    setCurrentChat(null)
    setMessages([])
    // Close sidebar on mobile when starting new chat
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    // Optional: You can add a smooth scroll to top when starting new chat
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveMessage = async (chatId: string, content: string, role: 'user' | 'assistant') => {
    try {
      // First try with role field
      let response = await fetch(HASURA_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : { 'x-hasura-admin-secret': HASURA_ADMIN_SECRET }),
        },
        body: JSON.stringify({
          query: `
            mutation InsertMessage($chatId: uuid!, $content: String!, $role: String!, $userId: uuid!) {
              insert_messages_one(object: { 
                chat_id: $chatId, 
                content: $content, 
                role: $role,
                user_id: $userId
              }) {
                id
                content
                created_at
              }
            }
          `,
          variables: { 
            chatId, 
            content, 
            role,
            userId: user?.id 
          },
        }),
      })
      
      let result: HasuraResponse = await response.json()
      
      // If there's an error with the role field, try without it
      if (result.errors && result.errors.some((err: HasuraError) => err.message.includes('role'))) {
        
        response = await fetch(HASURA_GRAPHQL_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : { 'x-hasura-admin-secret': HASURA_ADMIN_SECRET }),
          },
          body: JSON.stringify({
            query: `
              mutation InsertMessage($chatId: uuid!, $content: String!, $userId: uuid!) {
                insert_messages_one(object: { 
                  chat_id: $chatId, 
                  content: $content,
                  user_id: $userId
                }) {
                  id
                  content
                  created_at
                }
              }
            `,
            variables: { 
              chatId, 
              content,
              userId: user?.id 
            },
          }),
        })
        
        result = await response.json()
      }
      
      return result;
    } catch (error) {
      console.error('Error saving message:', error)
      return null
    }
  }

  if (!mounted) return null
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading your chatbot...</p>
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
              : { 'x-hasura-admin-secret': HASURA_ADMIN_SECRET }),
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

        const createChatData: HasuraResponse = await createChatRes.json()
        
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
   
      // Call n8n webhook using environment variable
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: currentMessage,
          chat_id: chatId
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(`Failed to get response from bot: ${response.status}`)
      }

      // Extract response from n8n webhook format
      const botReply = data[0]?.output || data?.response || 'Sorry, I could not process your request.'
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
    <div className="flex h-screen bg-white relative">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`${
        sidebarOpen 
          ? 'fixed inset-y-0 left-0 z-50 w-80 lg:relative lg:z-auto' 
          : 'hidden lg:block lg:w-0'
        } lg:${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden`}>
        
        {/* Mobile close button */}
        <div className="lg:hidden absolute top-4 right-4 z-10">
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg bg-white shadow-md hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-4 lg:p-6 border-b border-gray-200 bg-white">
          <button
            onClick={startNewChat}
            className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-gray-900 to-black hover:from-black hover:to-gray-800 text-white transition-all duration-200 flex items-center justify-center space-x-2 font-medium shadow-sm hover:shadow-md transform hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5" />
            <span>New Chat</span>
          </button>   
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-4 flex items-center uppercase tracking-wide">
              <Clock className="w-4 h-4 mr-2" />
              Recent Conversations
            </h3>
            <div className="space-y-1">
              {chatHistory.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => loadChatMessages(chat)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                    currentChat?.id === chat.id
                      ? 'bg-black text-white'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <MessageCircle className={`w-4 h-4 mt-0.5 ${
                      currentChat?.id === chat.id ? 'text-white' : 'text-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate mb-1">
                        {chat.title}
                      </div>
                      <div className={`text-xs ${
                        currentChat?.id === chat.id ? 'text-gray-300' : 'text-gray-500'
                      }`}>
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
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-black rounded-full flex items-center justify-center">
                <UserCircle className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {user?.displayName || user?.email?.split('@')[0]}
                </div>
                <div className="text-xs text-gray-500 truncate">{user?.email}</div>
              </div>
            </div>
            <button 
              onClick={() => signOut()}
              className="p-2 text-gray-400 hover:text-black transition-colors rounded-lg hover:bg-gray-100"
              title="Sign out"
            >
              <LogOut className="w-4 h-4 lg:w-5 lg:h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 lg:space-x-4 min-w-0 flex-1">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <Menu className="w-5 h-5 lg:w-6 lg:h-6 text-gray-600" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg lg:text-xl font-bold text-gray-900 truncate">
                  {currentChat?.title || 'New Conversation'}
                </h1>
                <p className="text-xs lg:text-sm text-gray-500 flex items-center">
                  {currentChat ? (
                    <>
                      <MessageCircle className="w-3 h-3 lg:w-4 lg:h-4 mr-1 flex-shrink-0" />
                      <span className="truncate">
                        Continuing chat from {new Date(currentChat.created_at).toLocaleDateString()}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 lg:w-4 lg:h-4 mr-1 flex-shrink-0" />
                      <span>AI Assistant • Ready to help</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 lg:space-y-6 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center mt-8 lg:mt-20 px-4">
              <div className="mb-6 lg:mb-8">
                <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-gray-900 to-black rounded-2xl flex items-center justify-center mx-auto mb-4 lg:mb-6 shadow-lg">
                  <Sparkles className="w-8 h-8 lg:w-10 lg:h-10 text-white" />
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2 lg:mb-3">
                  Ready to Chat!
                </h2>
                <p className="text-gray-600 max-w-md mx-auto leading-relaxed mb-6 lg:mb-8 text-sm lg:text-base">
                  Start a fresh conversation with your AI assistant. Ask questions, get help, or explore ideas together.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 max-w-2xl mx-auto">
                {[
                  { text: "Help me write an email", icon: "✉️" },
                  { text: "Explain a complex topic", icon: "🧠" },
                  { text: "Brainstorm some ideas", icon: "💡" }
                ].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(suggestion.text)}
                    className="p-3 lg:p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 text-xs lg:text-sm text-gray-700 font-medium shadow-sm hover:shadow-md group"
                  >
                    <div className="text-xl lg:text-2xl mb-2 group-hover:scale-110 transition-transform duration-200">
                      {suggestion.icon}
                    </div>
                    {suggestion.text}
                  </button>
                ))}
              </div>
              {chatHistory.length > 0 && (
                <div className="mt-6 lg:mt-8 pt-6 lg:pt-8 border-t border-gray-200">
                  <p className="text-xs lg:text-sm text-gray-500 mb-4">
                    Or continue from your previous conversations in the sidebar
                  </p>
                </div>
              )}
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-end space-x-2 lg:space-x-3 max-w-[85%] sm:max-w-[75%] ${msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.sender === 'user' 
                    ? 'bg-black' 
                    : 'bg-white border border-gray-200'
                }`}>
                  {msg.sender === 'user' ? (
                    <UserCircle className="w-3 h-3 lg:w-5 lg:h-5 text-white" />
                  ) : (
                    <Sparkles className="w-3 h-3 lg:w-5 lg:h-5 text-gray-600" />
                  )}
                </div>
                <div
                  className={`px-3 py-2 lg:px-4 lg:py-3 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-black text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
                  }`}
                >
                  <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.text}
                  </div>
                  {msg.timestamp && (
                    <div className={`text-xs mt-2 ${
                      msg.sender === 'user' ? 'text-gray-300' : 'text-gray-500'
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
              <div className="flex items-end space-x-2 lg:space-x-3">
                <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 lg:w-5 lg:h-5 text-gray-600" />
                </div>
                <div className="bg-white border border-gray-200 px-3 py-2 lg:px-4 lg:py-3 rounded-2xl rounded-bl-md">
                  <div className="flex space-x-1">
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
        <div className="bg-white border-t border-gray-200 p-4 lg:p-6">
          <div className="flex space-x-3 lg:space-x-4 items-end max-w-4xl mx-auto">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 lg:px-4 lg:py-3 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none text-gray-900 placeholder-gray-500 text-sm lg:text-base"
                placeholder="Type your message here..."
                rows={1}
                disabled={isTyping}
                style={{
                  minHeight: '40px',
                  maxHeight: '120px',
                  resize: 'none'
                }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="bg-black text-white p-2 lg:p-3 rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center min-w-[40px] lg:min-w-[48px] flex-shrink-0"
            >
              {isTyping ? (
                <div className="w-4 h-4 lg:w-5 lg:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send className="w-4 h-4 lg:w-5 lg:h-5" />
              )}
            </button>
          </div>
          <div className="mt-2 lg:mt-3 text-center">
            <p className="text-xs text-gray-500">
              Press Enter to send, Shift + Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}