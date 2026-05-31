import { useState } from "react";
import { X, Send, MessageSquare } from "lucide-react";
import { submitFeedback } from "../api/feedback.api";

const FeedbackModal = ({ isOpen, onClose }) => {
  const [type, setType] = useState("suggestion");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await submitFeedback({ type, message, email });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setMessage("");
        setEmail("");
        setType("suggestion");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md glass-card border border-white/10 glow-blue overflow-hidden shadow-2xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <MessageSquare size={20} className="text-neon-blue" />
              <h2 className="text-xl font-bold text-white text-glow">Send Feedback</h2>
            </div>
            <button 
              onClick={onClose}
              className="text-text-muted hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {success ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-neon-green/10 flex items-center justify-center mx-auto mb-4 border border-neon-green/30">
                <Send size={24} className="text-neon-green" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Thank You!</h3>
              <p className="text-sm text-text-muted">Your feedback has been received. We appreciate your input.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl text-sm bg-neon-pink/10 border border-neon-pink/30 text-neon-pink">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-text-muted">
                  Feedback Type
                </label>
                <select 
                  value={type} 
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-surface/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-neon-blue transition-colors"
                >
                  <option value="suggestion">Suggestion / Idea</option>
                  <option value="query">Question / Query</option>
                  <option value="bug">Report a Bug</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-text-muted">
                  Message
                </label>
                <textarea 
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's on your mind..."
                  className="w-full bg-surface/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-neon-blue transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-text-muted">
                  Email (Optional)
                </label>
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="For follow-up questions"
                  className="w-full bg-surface/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-neon-blue transition-colors"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={submitting || !message.trim()}
                  className="w-full btn-primary py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? "Sending..." : (
                    <>
                      Send Feedback <Send size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
