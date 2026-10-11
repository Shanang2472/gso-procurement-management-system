import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Bot, Sparkles, User, HelpCircle, ArrowRight } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

interface UserProfile {
  name: string;
  role: 'End User' | 'GSO Officer' | 'BAC Secretariat' | 'Budget Officer' | 'Mayor';
}

interface ProcurementChatbotProps {
  currentUser: UserProfile | null;
}

export const ProcurementChatbot: React.FC<ProcurementChatbotProps> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userName = currentUser?.name || 'Authorized Officer';
  const userRole = currentUser?.role || 'End User';

  // Generate initial welcome message based on user role
  const getInitialWelcome = (role: string, name: string): string => {
    const capitalizedName = name.toUpperCase();
    switch (role) {
      case 'Mayor':
        return `Greetings, Mayor ${capitalizedName}. I am your Executive Procurement Advisor. I can assist you with high-level contract approvals, sign-off rules for Purchase Orders and NTPs under RA 9184, and executive budget monitoring. What would you like to check today?`;
      case 'GSO Officer':
        return `Mabuhay, ${userName}! As the LGU General Services Officer, I am here to assist you with property distribution ledger tagging (ICS/PAR), Inspection and Acceptance Reports (IAR), delivery timelines, and logistics. How can I support your operations today?`;
      case 'BAC Secretariat':
        return `Hello, ${userName}! I am your BAC Bidding Advisor. I can help you draft Request for Quotations (RFQ), verify Abstract of Canvass thresholds, or prepare Bids and Awards Committee resolution templates. Let me know what you need.`;
      case 'Budget Officer':
        return `Welcome, Mrs./Mr. ${capitalizedName.split(' ')[0]}. I am your LGU Finance and Budget Advisor. I am here to help you trace ALOBS numbers, certified budget limits, and APP utilization rates. Let me know how I can assist with financial tracking today.`;
      default:
        return `Mabuhay, ${userName}! I am your GSO Procurement Helpdesk Assistant. I can help you find standard PPMP items, draft compliant purchase requests (PR), and track your current requisitions. What can I do for you today?`;
    }
  };

  // Preset suggestions based on role
  const getPresetSuggestions = (role: string) => {
    switch (role) {
      case 'Mayor':
        return [
          'What are my responsibilities as HOPE under RA 9184?',
          'How do I approve a Purchase Order?',
          'Explain liquidated damages penalty rules'
        ];
      case 'GSO Officer':
        return [
          'What is the difference between ICS and PAR property tags?',
          'How is the Inspection and Acceptance Report (IAR) generated?',
          'What are GSO officer warehousing duties?'
        ];
      case 'BAC Secretariat':
        return [
          'What is the threshold for Alternative Methods of Procurement?',
          'How do we declare a failure of bidding?',
          'Explain the Abstract of Canvass scoring'
        ];
      case 'Budget Officer':
        return [
          'How is the ALOBS number certified?',
          'What is the budget utilization rate formula?',
          'How is PPMP budget allocation tracked?'
        ];
      default:
        return [
          'How do I submit a new Purchase Request?',
          'Where do I find my department PPMP items?',
          'What are the basic steps of the GSO procurement pipeline?'
        ];
    }
  };

  // Initialize welcome message once
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeText = getInitialWelcome(userRole, userName);
      setMessages([
        {
          id: 'welcome',
          sender: 'bot',
          content: welcomeText,
          timestamp: new Date()
        }
      ]);
    }
  }, [userRole, userName]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const token = localStorage.getItem('gso_token');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.content
          })),
          user: { name: userName, role: userRole }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from server');
      }

      const data = await response.json();
      
      setMessages(prev => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          content: data.reply || 'I apologize, but I could not formulate a response at this moment.',
          timestamp: new Date()
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'bot',
          content: 'An error occurred while communicating with the procurement advisor. Please verify that your dev server is active.',
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const suggestions = getPresetSuggestions(userRole);

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans print:hidden">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-96 h-[520px] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white relative shadow-md shadow-indigo-900/40">
                  <Bot size={18} />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full" />
                </div>
                <div>
                  <h4 className="text-xs font-bold tracking-wide uppercase flex items-center gap-1">
                    <span>LGU Advisor</span>
                    <Sparkles size={11} className="text-amber-400 fill-amber-400" />
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium">Role: {userRole} Assistant</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'
                  }`}>
                    {msg.sender === 'user' ? <User size={12} /> : <Bot size={12} />}
                  </div>
                  <div className={`flex flex-col max-w-[78%] ${msg.sender === 'user' ? 'items-end' : ''}`}>
                    <div className={`rounded-xl p-3 text-xs leading-relaxed ${
                      msg.sender === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm shadow-indigo-600/10 font-medium' 
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs font-sans'
                    }`}>
                      {msg.content.split('\n').map((para, i) => (
                        <p key={i} className={i > 0 ? 'mt-2' : ''}>{para}</p>
                      ))}
                    </div>
                    <span className="text-[9px] text-slate-400 font-medium font-mono mt-1">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center shrink-0">
                    <Bot size={12} />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl rounded-tl-none p-3 shadow-xs">
                    <div className="flex gap-1 items-center py-1 px-1.5">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions Drawer/Tray (Only visible when user has not typed much) */}
            {messages.length === 1 && (
              <div className="px-4 py-3 bg-white border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <HelpCircle size={10} />
                  <span>Suggested for your role</span>
                </p>
                <div className="flex flex-col gap-1.5">
                  {suggestions.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(sug)}
                      className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-2.5 py-1.5 text-[10px] text-slate-600 font-medium transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <span className="truncate mr-2">{sug}</span>
                      <ArrowRight size={10} className="text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Form */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputValue);
              }}
              className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Ask as ${userRole}...`}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-sans text-slate-800"
                disabled={isTyping}
              />
              <button
                type="submit"
                disabled={isTyping || !inputValue.trim()}
                className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white flex items-center justify-center transition-colors shadow-sm shrink-0 cursor-pointer"
              >
                <Send size={14} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launcher Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-full flex items-center justify-center shadow-xl cursor-pointer relative group border border-slate-800"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -45, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 45, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={20} />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 45, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -45, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative"
            >
              <MessageSquare size={20} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};
