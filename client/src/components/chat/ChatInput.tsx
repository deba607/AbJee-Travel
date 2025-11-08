import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Smile, X } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface ChatInputProps {
  onSendMessage: (content: string, replyTo?: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  replyTo?: Message | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onTypingStart,
  onTypingStop,
  replyTo,
  onCancelReply,
  disabled = false,
  placeholder = "Type a message..."
}) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Common emojis for quick access
  const commonEmojis = ['😊', '😂', '❤️', '👍', '🎉', '😍', '🤔', '😢', '🔥', '✨', '🙏', '💯'];

  useEffect(() => {
    // Auto-focus the textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Close emoji picker when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Handle typing indicators
    if (value.trim() && !isTyping) {
      setIsTyping(true);
      onTypingStart();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        onTypingStop();
      }
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled) return;

    // Send message
    onSendMessage(trimmedMessage, replyTo?.id);
    
    // Clear input
    setMessage('');
    
    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      onTypingStop();
    }

    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Focus back to textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCancelReply = () => {
    if (onCancelReply) {
      onCancelReply();
    }
  };

  const handleAttachmentClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      // TODO: Handle file upload
      console.log('File selected:', file.name);
      alert(`File attachment feature coming soon!\nSelected: ${file.name}`);
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleEmojiClick = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.substring(0, start) + emoji + message.substring(end);
      setMessage(newMessage);
      
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setMessage(message + emoji);
    }
    setShowEmojiPicker(false);
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="border-t bg-background p-4">
      {/* Reply Preview */}
      {replyTo && (
        <div className="mb-3 p-3 bg-muted rounded-lg border-l-4 border-primary">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-muted-foreground">
                Replying to {replyTo.sender.firstName} {replyTo.sender.lastName}
              </div>
              <div className="text-sm truncate mt-1">
                {replyTo.content}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelReply}
              className="ml-2 h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[44px] max-h-32 resize-none pr-20"
            rows={1}
          />
          
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
          />
          
          {/* Emoji Picker Popup */}
          {showEmojiPicker && (
            <div 
              ref={emojiPickerRef}
              className="absolute bottom-12 right-2 bg-popover border rounded-lg shadow-lg p-2 z-10"
            >
              <div className="grid grid-cols-6 gap-1">
                {commonEmojis.map((emoji, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleEmojiClick(emoji)}
                    className="text-2xl hover:bg-accent rounded p-1 transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="text-xs text-muted-foreground text-center mt-2 pt-2 border-t">
                Click to insert emoji
              </div>
            </div>
          )}
          
          {/* Input Actions */}
          <div className="absolute right-2 bottom-2 flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={disabled}
              onClick={handleAttachmentClick}
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={disabled}
              onClick={toggleEmojiPicker}
              title="Add emoji"
            >
              <Smile className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={!message.trim() || disabled}
          className="h-11 px-4"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {/* Character count or other info */}
      <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
        <div>
          {isTyping && <span>Typing...</span>}
        </div>
        <div>
          {message.length > 1800 && (
            <span className={message.length > 2000 ? 'text-destructive' : 'text-warning'}>
              {message.length}/2000
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
