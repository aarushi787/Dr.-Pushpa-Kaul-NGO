/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useContext, createContext, Component } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Hospital, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  Menu, 
  X, 
  Phone, 
  Mail, 
  MapPin,
  Stethoscope,
  HandHelping,
  ShieldCheck,
  Facebook,
  Instagram,
  Twitter,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  LogIn,
  LogOut,
  User as UserIcon,
  Plus,
  Sparkles,
  Upload,
  Camera,
  BarChart3,
  Calendar,
  Users2,
  Filter,
  ArrowUpDown,
  Search
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { cn } from './lib/utils';
import { 
  storage,
  auth, 
  db, 
  googleProvider, 
  type FirebaseUser, 
  Timestamp, 
  testConnection 
} from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification
} from 'firebase/auth';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { 
  Share2,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Twitter as TwitterIcon,
  Facebook as FacebookIcon,
  Linkedin as LinkedinIcon
} from 'lucide-react';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocFromServer, 
  onSnapshot, 
  query, 
  where,
  orderBy,
  limit,
  deleteDoc,
  addDoc,
  updateDoc,
  getDocs
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { 
  BrowserRouter as Router,
  Routes, 
  Route, 
  Link, 
  useNavigate, 
  useLocation,
  Navigate
} from 'react-router-dom';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Context ---

interface AuthContextType {
  user: FirebaseUser | null;
  role: 'user' | 'admin';
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  sendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Sync user to Firestore and get role
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            setRole(userDoc.data().role || 'user');
          } else {
            // New user
            const newRole = 'user';
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: newRole,
              createdAt: Timestamp.now()
            });
            setRole(newRole);
          }
        } catch (error) {
          console.error("Error syncing user:", error);
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
        setRole('user');
      }
      setLoading(false);
    });

    testConnection();

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const sendVerification = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
      } catch (error) {
        console.error("Verification error:", error);
        throw error;
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, logout, sendVerification }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorInfo: string | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "Something went wrong. Please try again later.";
      try {
        const parsed = JSON.parse(this.state.errorInfo || "");
        if (parsed.error && parsed.error.includes("Missing or insufficient permissions")) {
          displayMessage = "You don't have permission to perform this action. Please sign in or contact support.";
        }
      } catch (e) {
        // Not a JSON error info
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <X size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Application Error</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">{displayMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Components ---

const LoadingSpinner = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <div className={cn("animate-spin text-emerald-600", className)}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  </div>
);

const Skeleton = ({ className, ...props }: { className?: string, [key: string]: any }) => (
  <div className={cn("animate-pulse bg-slate-200 rounded-xl", className)} {...props} />
);

const SEO = ({ title, description, image }: { title?: string, description?: string, image?: string }) => {
  const siteName = "Dr. Pushpa Kaul NGO";
  const defaultTitle = "Dr. Pushpa Kaul NGO | SJM Healthcare Initiative";
  const defaultDescription = "Dr. Pushpa Kaul NGO, an initiative by SJM Healthcare, provides free medical camps, health awareness, and subsidized treatments to underserved communities.";
  const defaultImage = "https://picsum.photos/seed/ngo/1200/630";

  return (
    <Helmet>
      <title>{title ? `${title} | ${siteName}` : defaultTitle}</title>
      <meta name="description" content={description || defaultDescription} />
      <meta property="og:title" content={title || defaultTitle} />
      <meta property="og:description" content={description || defaultDescription} />
      <meta property="og:image" content={image || defaultImage} />
      <meta name="twitter:card" content="summary_large_image" />
    </Helmet>
  );
};

const CookieConsent = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleConsent = (accepted: boolean) => {
    localStorage.setItem('cookie-consent', accepted ? 'accepted' : 'rejected');
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-6 right-6 z-[60] md:left-auto md:right-8 md:max-w-md"
        >
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
              <h4 className="text-xl font-bold text-slate-900">Cookie Consent</h4>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed mb-8">
              We use cookies to enhance your browsing experience and analyze our traffic. By clicking "Accept", you consent to our use of cookies.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => handleConsent(true)}
                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all"
              >
                Accept
              </button>
              <button 
                onClick={() => handleConsent(false)}
                className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                Reject
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Feedback = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === null) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        rating,
        comment,
        userId: user?.uid || 'anonymous',
        userEmail: user?.email || 'anonymous',
        submittedAt: Timestamp.now(),
        page: window.location.pathname
      });
      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setRating(null);
        setComment("");
      }, 3000);
    } catch (error) {
      console.error("Feedback error:", error);
    }
    setIsSubmitting(false);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-white text-slate-900 p-4 rounded-2xl shadow-xl border border-slate-100 hover:bg-slate-50 transition-all group flex items-center gap-2"
      >
        <MessageSquare size={20} className="text-emerald-600" />
        <span className="text-sm font-bold hidden md:block">Feedback</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              {submitted ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 size={40} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Thank You!</h3>
                  <p className="text-slate-500">Your feedback helps us improve.</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-bold text-slate-900">Leave Feedback</h3>
                    <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={24} />
                    </button>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-sm font-bold text-slate-700">How would you rate this page?</label>
                      <div className="flex justify-between gap-2">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setRating(num)}
                            className={cn(
                              "flex-1 py-4 rounded-2xl font-bold transition-all border",
                              rating === num 
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200" 
                                : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
                            )}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Comments (Optional)</label>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        placeholder="Tell us what you think..."
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={rating === null || isSubmitting}
                      className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? <LoadingSpinner size={20} className="text-white" /> : "Submit Feedback"}
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

const SocialShare = ({ title, url }: { title: string, url: string }) => {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const shares = [
    {
      name: 'Facebook',
      icon: <FacebookIcon size={18} />,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: 'hover:bg-blue-600 hover:text-white text-blue-600 bg-blue-50'
    },
    {
      name: 'Twitter',
      icon: <TwitterIcon size={18} />,
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      color: 'hover:bg-sky-500 hover:text-white text-sky-500 bg-sky-50'
    },
    {
      name: 'LinkedIn',
      icon: <LinkedinIcon size={18} />,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: 'hover:bg-blue-700 hover:text-white text-blue-700 bg-blue-50'
    }
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">Share:</span>
      {shares.map((share) => (
        <a
          key={share.name}
          href={share.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
            share.color
          )}
          title={`Share on ${share.name}`}
        >
          {share.icon}
        </a>
      ))}
    </div>
  );
};

const VerificationBanner = () => {
  const { user, sendVerification } = useAuth();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user || user.emailVerified) return null;

  const handleResend = async () => {
    setLoading(true);
    try {
      await sendVerification();
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    } catch (error) {
      alert("Failed to send verification email. Please try again later.");
    }
    setLoading(false);
  };

  return (
    <div className="bg-amber-50 border-b border-amber-100 py-3 px-6 text-center">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-center gap-4">
        <p className="text-sm text-amber-800 font-medium">
          Please verify your email address to access all features.
        </p>
        <button 
          onClick={handleResend}
          disabled={sent || loading}
          className="text-xs font-bold bg-amber-600 text-white px-4 py-1.5 rounded-full hover:bg-amber-700 transition-all disabled:opacity-50"
        >
          {loading ? "Sending..." : sent ? "Email Sent!" : "Resend Verification Email"}
        </button>
      </div>
    </div>
  );
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size={48} /></div>;
  if (!user || role !== 'admin') return <Navigate to="/" />;
  return <>{children}</>;
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size={48} /></div>;
  if (!user) return <Navigate to="/" />;
  return <>{children}</>;
};

const UserProfile = () => {
  const { user, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdating(true);
    setMessage(null);
    try {
      await updateProfile(user, { displayName, photoURL });
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { displayName, photoURL }, { merge: true });
      setMessage({ type: 'success', text: "Profile updated successfully!" });
    } catch (error) {
      console.error("Update error:", error);
      setMessage({ type: 'error', text: "Failed to update profile." });
    }
    setIsUpdating(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    setMessage(null);

    try {
      const storageRef = ref(storage, `profile_pictures/${user.uid}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setPhotoURL(downloadURL);
      setMessage({ type: 'success', text: "Image uploaded! Don't forget to save changes." });
    } catch (error) {
      console.error("Upload error:", error);
      setMessage({ type: 'error', text: "Failed to upload image." });
    }
    setIsUploading(false);
  };

  return (
    <div className="pt-32 pb-24 bg-slate-50 min-h-screen">
      <div className="max-w-2xl mx-auto px-6">
        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-xl border border-slate-100">
          <div className="flex items-center gap-6 mb-12">
            <div className="relative group">
              <img 
                src={photoURL || "https://picsum.photos/seed/user/200/200"} 
                alt="Profile" 
                className="w-24 h-24 rounded-3xl object-cover border-4 border-emerald-50 shadow-md transition-all group-hover:opacity-80"
              />
              <label className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-all">
                <div className="bg-black/40 p-2 rounded-full text-white">
                  <Camera size={20} />
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
              </label>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                {isUploading ? <LoadingSpinner size={16} className="text-white" /> : <UserIcon size={16} />}
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">{user?.displayName || "User Profile"}</h2>
              <p className="text-slate-500">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Display Name</label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="Your Name"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Photo URL (or upload above)</label>
              <input 
                type="url" 
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="https://example.com/photo.jpg"
              />
            </div>

            {message && (
              <div className={cn(
                "p-4 rounded-2xl text-sm font-medium",
                message.type === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              )}>
                {message.text}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button 
                type="submit"
                disabled={isUpdating}
                className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUpdating ? <LoadingSpinner size={20} className="text-white" /> : "Save Changes"}
              </button>
              <button 
                type="button"
                onClick={logout}
                className="px-8 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
              >
                Logout
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'analytics' | 'subscribers' | 'submissions' | 'events' | 'users'>('analytics');
  
  // Filtering & Sorting State
  const [subSearch, setSubSearch] = useState("");
  const [subSort, setSubSort] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'subscribedAt', dir: 'desc' });
  const [contactSearch, setContactSearch] = useState("");
  const [contactSort, setContactSort] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'submittedAt', dir: 'desc' });
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  // Event Form State
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [eventForm, setEventForm] = useState({ title: '', date: '', time: '', location: '', description: '' });

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Subscribers
    const qSub = query(collection(db, 'newsletter_subscribers'), orderBy('subscribedAt', 'desc'));
    unsubscribers.push(onSnapshot(qSub, (snapshot) => {
      setSubscribers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }));

    // Submissions
    const qContact = query(collection(db, 'contact_submissions'), orderBy('submittedAt', 'desc'));
    unsubscribers.push(onSnapshot(qContact, (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }));

    // Donations
    const qDonations = query(collection(db, 'donations'), orderBy('donatedAt', 'desc'));
    unsubscribers.push(onSnapshot(qDonations, (snapshot) => {
      setDonations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }));

    // Events
    const qEvents = query(collection(db, 'events'), orderBy('date', 'asc'));
    unsubscribers.push(onSnapshot(qEvents, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }));

    // Users
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    unsubscribers.push(onSnapshot(qUsers, (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }));

    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  const handleDelete = async (coll: string, id: string) => {
    if (!window.confirm(`Are you sure you want to delete this ${coll.slice(0, -1)}?`)) return;
    try {
      await deleteDoc(doc(db, coll, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${coll}/${id}`);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        await updateDoc(doc(db, 'events', editingEvent.id), { ...eventForm });
      } else {
        await addDoc(collection(db, 'events'), { ...eventForm, createdAt: Timestamp.now() });
      }
      setShowEventModal(false);
      setEditingEvent(null);
      setEventForm({ title: '', date: '', time: '', location: '', description: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'events');
    }
  };

  // Analytics Data Processing
  const donationStats = donations.reduce((acc: any, curr: any) => {
    const date = curr.donatedAt?.toDate().toLocaleDateString() || 'Unknown';
    acc[date] = (acc[date] || 0) + curr.amount;
    return acc;
  }, {});

  const chartData = Object.keys(donationStats).map(date => ({
    date,
    amount: donationStats[date]
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalDonations = donations.reduce((sum, d) => sum + (d.amount || 0), 0);

  const allocationStats = donations.reduce((acc: any, curr: any) => {
    const alloc = curr.allocation || 'General Fund';
    acc[alloc] = (acc[alloc] || 0) + (curr.amount || 0);
    return acc;
  }, {});

  const allocationChartData = Object.keys(allocationStats).map(name => ({
    name,
    value: allocationStats[name]
  })).sort((a, b) => b.value - a.value);

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#64748b'];

  // Filtering Logic
  const filterByDate = (date: any) => {
    if (!date) return true;
    const d = date.toDate ? date.toDate() : new Date(date);
    if (dateRange.start && d < new Date(dateRange.start)) return false;
    if (dateRange.end && d > new Date(dateRange.end)) return false;
    return true;
  };

  const filteredSubs = subscribers
    .filter(s => s.email.toLowerCase().includes(subSearch.toLowerCase()) && filterByDate(s.subscribedAt))
    .sort((a, b) => {
      const valA = a[subSort.key];
      const valB = b[subSort.key];
      if (subSort.dir === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

  const filteredSubmissions = submissions
    .filter(s => (s.email.toLowerCase().includes(contactSearch.toLowerCase()) || s.subject.toLowerCase().includes(contactSearch.toLowerCase())) && filterByDate(s.submittedAt))
    .sort((a, b) => {
      const valA = a[contactSort.key];
      const valB = b[contactSort.key];
      if (contactSort.dir === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

  return (
    <div className="pt-32 pb-24 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
          <div>
            <h2 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">Admin Dashboard</h2>
            <p className="text-slate-500 font-medium">Comprehensive management for Dr. Pushpa Kaul NGO.</p>
          </div>
          
          <div className="flex flex-wrap bg-white p-1.5 rounded-[1.5rem] shadow-sm border border-slate-100">
            {[
              { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
              { id: 'subscribers', label: 'Subscribers', icon: <Users size={18} /> },
              { id: 'submissions', label: 'Inquiries', icon: <Mail size={18} /> },
              { id: 'events', label: 'Events', icon: <Calendar size={18} /> },
              { id: 'users', label: 'User Roles', icon: <Users2 size={18} /> }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  activeTab === tab.id ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <LoadingSpinner size={48} />
          </div>
        ) : (
          <div className="space-y-8">
            {activeTab === 'analytics' && (
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                    <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                        <Heart size={20} />
                      </div>
                      Donation Trends
                    </h3>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                      <h4 className="text-lg font-bold text-slate-900 mb-6">Engagement Overview</h4>
                      <div className="h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[
                            { name: 'Subscribers', count: subscribers.length },
                            { name: 'Inquiries', count: submissions.length },
                            { name: 'Events', count: events.length }
                          ]}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: '#f8fafc' }} />
                            <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                      <h4 className="text-lg font-bold text-slate-900 mb-6">Fund Allocation (by Amount)</h4>
                      <div className="grid md:grid-cols-2 gap-8 items-center">
                        <div className="h-[240px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={allocationChartData}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {allocationChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value: number) => `₹${value.toLocaleString()}`}
                                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-4">
                          {allocationChartData.map((item, idx) => (
                            <div key={item.name} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                <span className="text-sm font-medium text-slate-600 truncate max-w-[120px]">{item.name}</span>
                              </div>
                              <span className="text-sm font-bold text-slate-900">₹{item.value.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-emerald-100">
                    <p className="text-emerald-100 text-sm font-bold uppercase tracking-widest mb-2">Total Donations</p>
                    <h4 className="text-4xl font-bold mb-6">₹{totalDonations.toLocaleString()}</h4>
                    <div className="flex items-center gap-2 text-emerald-100 text-sm">
                      <ArrowRight size={16} />
                      <span>{donations.length} total contributions</span>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                    <h4 className="text-lg font-bold text-slate-900 mb-6">Recent Activity</h4>
                    <div className="space-y-6">
                      {donations.slice(0, 5).map((d, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                            <Plus size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">₹{d.amount} from {d.userEmail}</p>
                            <p className="text-xs text-slate-500">{d.donatedAt?.toDate().toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(activeTab === 'subscribers' || activeTab === 'submissions') && (
              <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text"
                      placeholder={`Search ${activeTab}...`}
                      value={activeTab === 'subscribers' ? subSearch : contactSearch}
                      onChange={(e) => activeTab === 'subscribers' ? setSubSearch(e.target.value) : setContactSearch(e.target.value)}
                      className="w-full pl-12 pr-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                      <input 
                        type="date" 
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="bg-transparent text-xs font-bold text-slate-600 p-2 focus:outline-none"
                      />
                      <span className="text-slate-300">-</span>
                      <input 
                        type="date" 
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="bg-transparent text-xs font-bold text-slate-600 p-2 focus:outline-none"
                      />
                    </div>
                    <button 
                      onClick={() => setDateRange({ start: "", end: "" })}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        {activeTab === 'subscribers' ? (
                          <>
                            <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-slate-400">
                              <button onClick={() => setSubSort({ key: 'email', dir: subSort.dir === 'asc' ? 'desc' : 'asc' })} className="flex items-center gap-2">
                                Email Address <ArrowUpDown size={12} />
                              </button>
                            </th>
                            <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-slate-400">
                              <button onClick={() => setSubSort({ key: 'subscribedAt', dir: subSort.dir === 'asc' ? 'desc' : 'asc' })} className="flex items-center gap-2">
                                Subscribed At <ArrowUpDown size={12} />
                              </button>
                            </th>
                          </>
                        ) : (
                          <>
                            <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-slate-400">Name</th>
                            <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-slate-400">
                              <button onClick={() => setContactSort({ key: 'email', dir: contactSort.dir === 'asc' ? 'desc' : 'asc' })} className="flex items-center gap-2">
                                Email <ArrowUpDown size={12} />
                              </button>
                            </th>
                            <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-slate-400">
                              <button onClick={() => setContactSort({ key: 'subject', dir: contactSort.dir === 'asc' ? 'desc' : 'asc' })} className="flex items-center gap-2">
                                Subject <ArrowUpDown size={12} />
                              </button>
                            </th>
                            <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-slate-400">
                              <button onClick={() => setContactSort({ key: 'submittedAt', dir: contactSort.dir === 'asc' ? 'desc' : 'asc' })} className="flex items-center gap-2">
                                Date <ArrowUpDown size={12} />
                              </button>
                            </th>
                          </>
                        )}
                        <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(activeTab === 'subscribers' ? filteredSubs : filteredSubmissions).map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          {activeTab === 'subscribers' ? (
                            <>
                              <td className="px-8 py-6 font-medium text-slate-900">{item.email}</td>
                              <td className="px-8 py-6 text-slate-500">{item.subscribedAt?.toDate().toLocaleString()}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-8 py-6 font-medium text-slate-900">{item.name}</td>
                              <td className="px-8 py-6 text-slate-500">{item.email}</td>
                              <td className="px-8 py-6 text-slate-500">{item.subject}</td>
                              <td className="px-8 py-6 text-slate-500">{item.submittedAt?.toDate().toLocaleString()}</td>
                            </>
                          )}
                          <td className="px-8 py-6 text-right">
                            <button 
                              onClick={() => handleDelete(activeTab === 'subscribers' ? 'newsletter_subscribers' : 'contact_submissions', item.id)}
                              className="text-red-400 hover:text-red-600 transition-colors p-2"
                            >
                              <X size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'events' && (
              <div className="space-y-8">
                <div className="flex justify-end">
                  <button 
                    onClick={() => { setEditingEvent(null); setEventForm({ title: '', date: '', time: '', location: '', description: '' }); setShowEventModal(true); }}
                    className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                  >
                    <Plus size={20} /> Add New Event
                  </button>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {events.map((event) => (
                    <div key={event.id} className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 group">
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                          <Calendar size={24} />
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setEditingEvent(event); setEventForm({ ...event }); setShowEventModal(true); }}
                            className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                          >
                            <Sparkles size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete('events', event.id)}
                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                      <h4 className="text-xl font-bold text-slate-900 mb-2">{event.title}</h4>
                      <p className="text-slate-500 text-sm mb-6 line-clamp-2">{event.description}</p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <Calendar size={16} className="text-emerald-500" />
                          {event.date}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <Sparkles size={16} className="text-emerald-500" />
                          {event.time}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <MapPin size={16} className="text-emerald-500" />
                          {event.location}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-slate-400">User</th>
                        <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-slate-400">Email</th>
                        <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-slate-400">Role</th>
                        <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-slate-400">Joined</th>
                        <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <img src={u.photoURL || "https://picsum.photos/seed/user/100/100"} className="w-10 h-10 rounded-xl object-cover" alt="" />
                              <span className="font-bold text-slate-900">{u.displayName || "Anonymous"}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-slate-500">{u.email}</td>
                          <td className="px-8 py-6">
                            <select 
                              value={u.role}
                              onChange={(e) => handleUpdateRole(u.id, e.target.value as any)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold border focus:outline-none",
                                u.role === 'admin' ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-slate-50 text-slate-600 border-slate-100"
                              )}
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="px-8 py-6 text-slate-500">{u.createdAt?.toDate().toLocaleDateString()}</td>
                          <td className="px-8 py-6 text-right">
                            <button 
                              onClick={() => handleDelete('users', u.id)}
                              className="text-red-400 hover:text-red-600 p-2"
                            >
                              <X size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event Modal */}
      <AnimatePresence>
        {showEventModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEventModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[2.5rem] p-8 md:p-10 shadow-2xl"
            >
              <h4 className="text-2xl font-bold text-slate-900 mb-8">{editingEvent ? 'Edit Event' : 'Add New Event'}</h4>
              <form onSubmit={handleEventSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Title</label>
                  <input 
                    type="text" required
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Date</label>
                    <input 
                      type="date" required
                      value={eventForm.date}
                      onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Time</label>
                    <input 
                      type="text" required
                      value={eventForm.time}
                      onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400"
                      placeholder="e.g. 10:00 AM"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Location</label>
                  <input 
                    type="text" required
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Description</label>
                  <textarea 
                    value={eventForm.description}
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400 min-h-[100px]"
                  />
                </div>
                <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all">
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, role, loading, signIn, logout } = useAuth();
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: isHome ? '#home' : '/#home' },
    { name: 'About', href: isHome ? '#about' : '/#about' },
    { name: 'Programs', href: isHome ? '#programs' : '/#programs' },
    { name: 'Gallery', href: isHome ? '#gallery' : '/#gallery' },
    { name: 'FAQ', href: isHome ? '#faq' : '/#faq' },
    { name: 'Contact', href: isHome ? '#contact' : '/#contact' },
  ];

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4",
      isScrolled ? "bg-white/90 backdrop-blur-md shadow-sm py-3" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
            <Heart size={24} fill="currentColor" />
          </div>
          <div className="flex flex-col">
            <span className={cn("font-bold text-lg leading-tight", isScrolled ? "text-slate-900" : "text-slate-900")}>
              Dr. Pushpa Kaul NGO
            </span>
            <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-semibold">
              By SJM Healthcare
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a 
              key={link.name} 
              href={link.href}
              className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors"
            >
              {link.name}
            </a>
          ))}
          
          {loading ? (
            <LoadingSpinner size={20} />
          ) : user ? (
            <div className="flex items-center gap-4">
              {role === 'admin' && (
                <Link 
                  to="/admin"
                  className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-all"
                >
                  Admin
                </Link>
              )}
              <Link to="/profile" className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-all">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ""} className="w-6 h-6 rounded-full" />
                ) : (
                  <UserIcon size={16} />
                )}
                <span className="text-xs font-bold text-slate-700">{user.displayName?.split(' ')[0]}</span>
              </Link>
              <button 
                onClick={logout}
                className="text-slate-500 hover:text-red-600 transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button 
              onClick={signIn}
              className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-emerald-600 transition-colors"
            >
              <LogIn size={18} /> Sign In
            </button>
          )}

          <a 
            href={isHome ? "#donate" : "/#donate"}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-emerald-700 transition-all shadow-md hover:shadow-lg active:scale-95 hover:-translate-y-0.5"
          >
            Donate Now
          </a>
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden text-slate-900"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 bg-white border-t border-slate-100 p-6 flex flex-col gap-4 md:hidden shadow-xl"
          >
            {navLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.href}
                className="text-lg font-medium text-slate-600"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </a>
            ))}
            
            {user ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <img src={user.photoURL || ""} alt="" className="w-10 h-10 rounded-full" />
                    <div>
                      <p className="font-bold text-slate-900">{user.displayName}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <button onClick={logout} className="text-red-600"><LogOut size={20} /></button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Link 
                    to="/profile" 
                    className="flex items-center justify-center gap-2 p-4 bg-slate-100 rounded-2xl font-bold text-slate-700 text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <UserIcon size={18} /> Profile
                  </Link>
                  {role === 'admin' && (
                    <Link 
                      to="/admin" 
                      className="flex items-center justify-center gap-2 p-4 bg-emerald-50 rounded-2xl font-bold text-emerald-700 text-sm"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <ShieldCheck size={18} /> Admin
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <button 
                onClick={() => { signIn(); setIsMobileMenuOpen(false); }}
                className="flex items-center justify-center gap-2 p-4 bg-slate-100 rounded-2xl font-bold text-slate-700"
              >
                <LogIn size={20} /> Sign In with Google
              </button>
            )}

            <a 
              href={isHome ? "#donate" : "/#donate"}
              className="bg-emerald-600 text-white px-5 py-3 rounded-xl text-center font-semibold"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Donate Now
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const MissionVision = () => {
  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative">
            <div className="absolute -top-12 -left-12 w-64 h-64 bg-emerald-50 rounded-full -z-10 blur-3xl opacity-60" />
            <img 
              src="https://picsum.photos/seed/mission/800/600" 
              alt="Mission" 
              className="rounded-[3rem] shadow-2xl object-cover aspect-[4/3]"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
            <div className="absolute -bottom-8 -right-8 bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-[280px]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                  <HandHelping size={20} />
                </div>
                <span className="font-bold text-slate-900">Our Commitment</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed italic">
                "To serve with dignity and provide healthcare where it's needed most."
              </p>
            </div>
          </div>

          <div className="space-y-12">
            <div>
              <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-4">Our Purpose</h2>
              <h3 className="text-4xl font-bold text-slate-900 mb-6">Mission & Vision</h3>
              <div className="space-y-8">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <h4 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <span className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-xs">M</span>
                    Our Mission
                  </h4>
                  <p className="text-slate-600 leading-relaxed">
                    To bridge the healthcare gap by providing comprehensive, high-quality medical services to underserved and marginalized communities, ensuring that financial constraints never stand in the way of life-saving care.
                  </p>
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <h4 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-xs">V</span>
                    Our Vision
                  </h4>
                  <p className="text-slate-600 leading-relaxed">
                    A world where healthcare is universally accessible, equitable, and compassionate. We envision a future where every individual, regardless of their socio-economic status, has the opportunity to lead a healthy and productive life.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Programs = () => {
  const programs = [
    {
      title: "Free Medical Camps",
      desc: "Regular health check-up camps in remote villages, providing free consultations and basic diagnostic tests.",
      icon: <Stethoscope size={24} />,
      color: "bg-emerald-50 text-emerald-600",
      image: "https://picsum.photos/seed/camp/600/400"
    },
    {
      title: "Health Awareness",
      desc: "Educational workshops on hygiene, nutrition, maternal health, and disease prevention for local communities.",
      icon: <Users size={24} />,
      color: "bg-blue-50 text-blue-600",
      image: "https://picsum.photos/seed/awareness/600/400"
    },
    {
      title: "Subsidized Treatments",
      desc: "Partnering with SJM Healthcare to provide advanced surgeries and specialized treatments at minimal costs.",
      icon: <Hospital size={24} />,
      color: "bg-purple-50 text-purple-600",
      image: "https://picsum.photos/seed/treatment/600/400"
    }
  ];

  const successStories = [
    {
      name: "Rajesh Kumar",
      story: "Thanks to the free medical camp, my chronic condition was diagnosed early. The NGO funded my entire surgery at SJM Healthcare.",
      location: "Noida Rural",
      image: "https://picsum.photos/seed/p1/100/100"
    },
    {
      name: "Meena Devi",
      story: "The maternal health program taught me so much. My baby is healthy, and I felt supported throughout my pregnancy.",
      location: "Greater Noida",
      image: "https://picsum.photos/seed/p2/100/100"
    }
  ];

  return (
    <section id="programs" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-3">Our Work</h2>
          <h3 className="text-4xl font-bold text-slate-900 mb-6">Impactful Healthcare Initiatives</h3>
          <p className="text-slate-600 leading-relaxed">
            We leverage SJM Healthcare's professional expertise to deliver a range of programs designed to improve community health outcomes.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-24">
          {programs.map((prog, i) => (
            <div key={i} className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-xl transition-all group">
              <div className="h-48 overflow-hidden">
                <img 
                  src={prog.image} 
                  alt={prog.title} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              </div>
              <div className="p-8">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6", prog.color)}>
                  {prog.icon}
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">{prog.title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">{prog.desc}</p>
                <div className="pt-6 border-t border-slate-50">
                  <SocialShare title={prog.title} url={window.location.origin + "/#programs"} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div id="testimonials" className="bg-emerald-600 rounded-[3rem] p-8 md:p-16 text-white">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl font-bold mb-6">Success Stories</h3>
              <p className="text-emerald-50 mb-8 leading-relaxed">
                Real impact on real lives. See how your support is changing the healthcare landscape for families in need.
              </p>
              <div className="flex gap-4">
                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                  <span className="block text-2xl font-bold">12k+</span>
                  <span className="text-xs text-emerald-100 uppercase tracking-widest">Patients Served</span>
                </div>
                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                  <span className="block text-2xl font-bold">50+</span>
                  <span className="text-xs text-emerald-100 uppercase tracking-widest">Medical Camps</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {successStories.map((story, i) => (
                <motion.div 
                  key={i}
                  whileHover={{ x: 10 }}
                  className="bg-white p-6 rounded-3xl text-slate-900 shadow-lg"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <img 
                      src={story.image} 
                      alt={story.name} 
                      className="w-12 h-12 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    <div>
                      <h5 className="font-bold">{story.name}</h5>
                      <span className="text-xs text-slate-400">{story.location}</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 italic leading-relaxed mb-4">
                    "{story.story}"
                  </p>
                  <SocialShare title={`Success Story: ${story.name}`} url={window.location.origin + "/#programs"} />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "How is the NGO funded?",
      answer: "Our primary funding comes from individual donations, corporate CSR initiatives, and direct support from SJM Healthcare, which provides us with medical expertise and facilities."
    },
    {
      question: "Can I volunteer for medical camps?",
      answer: "Yes! We welcome medical professionals, students, and general volunteers. Please reach out through our contact form to learn about upcoming camp schedules."
    },
    {
      question: "Are my donations tax-exempt?",
      answer: "Yes, all donations to Dr. Pushpa Kaul NGO are eligible for tax exemption under Section 80G of the Income Tax Act. You will receive a receipt for your contribution."
    },
    {
      question: "How do you select the locations for medical camps?",
      answer: "We focus on rural and underserved urban areas where healthcare access is minimal. We work with local community leaders to identify regions with the highest need."
    },
    {
      question: "What percentage of my donation goes to the cause?",
      answer: "Over 90% of every donation goes directly toward medical supplies, treatment costs, and camp logistics. Administrative costs are kept minimal thanks to SJM Healthcare's support."
    }
  ];

  return (
    <section id="faq" className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-3">Questions</h2>
          <h3 className="text-4xl font-bold text-slate-900">Frequently Asked Questions</h3>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-slate-100 rounded-2xl overflow-hidden">
              <button 
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full p-6 text-left flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span className="font-bold text-slate-900">{faq.question}</span>
                {openIndex === i ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-6 text-slate-600 text-sm leading-relaxed bg-white border-t border-slate-100">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Gallery = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [newImage, setNewImage] = useState({ url: '', category: 'Medical Camps', caption: '' });
  const [generating, setGenerating] = useState(false);
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const galleryData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setImages(galleryData);
      setLoading(false);
    }, (error) => {
      console.error("Gallery fetch error:", error);
      // Fallback to static images if Firestore fails or is empty
      if (images.length === 0) {
        setImages([
          { url: "https://picsum.photos/seed/camp1/800/600", caption: "Rural Medical Camp", category: "Medical Camps" },
          { url: "https://picsum.photos/seed/camp2/800/600", caption: "Health Checkup", category: "Medical Camps" },
          { url: "https://picsum.photos/seed/edu1/800/600", caption: "Hygiene Workshop", category: "Awareness" },
          { url: "https://picsum.photos/seed/edu2/800/600", caption: "Maternal Health Session", category: "Awareness" },
          { url: "https://picsum.photos/seed/success1/800/600", caption: "Patient Recovery", category: "Success Stories" },
          { url: "https://picsum.photos/seed/success2/800/600", caption: "Community Support", category: "Success Stories" },
        ]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const categories = ['All', 'Medical Camps', 'Awareness', 'Success Stories'];

  const filteredImages = activeCategory === 'All' 
    ? images 
    : images.filter(img => img.category === activeCategory);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImage.url || !newImage.category) return;

    try {
      await addDoc(collection(db, 'gallery'), {
        ...newImage,
        uploadedBy: user?.uid,
        createdAt: Timestamp.now()
      });
      setNewImage({ url: '', category: 'Medical Camps', caption: '' });
      setShowUpload(false);
    } catch (error) {
      console.error("Upload error:", error);
    }
  };

  const generateAIImage = async () => {
    setGenerating(true);
    try {
      if (typeof window !== 'undefined' && window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
        }
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `A high-quality, inspiring photo of ${newImage.category.toLowerCase()} for an NGO website. Realistic, professional photography, emotional and impactful.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        }
      });

      let imageUrl = '';
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        setNewImage(prev => ({ ...prev, url: imageUrl }));
      }
    } catch (error: any) {
      console.error("AI Generation error:", error);
      if (error.message?.includes("Requested entity was not found")) {
        if (window.aistudio) await window.aistudio.openSelectKey();
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section id="gallery" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
          <div className="max-w-2xl">
            <h2 className="text-emerald-600 font-bold uppercase tracking-widest text-sm mb-4">Our Gallery</h2>
            <h3 className="text-4xl font-bold text-slate-900 mb-6">Capturing Moments of Impact.</h3>
            <p className="text-slate-600">A visual journey through our medical camps, awareness programs, and the lives we've touched.</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-6 py-2.5 rounded-full text-sm font-bold transition-all",
                  activeCategory === cat 
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                    : "bg-white text-slate-600 hover:bg-slate-100"
                )}
              >
                {cat}
              </button>
            ))}
            {isAdmin && (
              <button 
                onClick={() => setShowUpload(true)}
                className="px-6 py-2.5 rounded-full text-sm font-bold bg-slate-900 text-white flex items-center gap-2 hover:bg-slate-800 transition-all"
              >
                <Plus size={18} /> Add Image
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="aspect-square rounded-[2rem]" />
            ))}
          </div>
        ) : filteredImages.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredImages.map((img, idx) => (
              <motion.div
                key={img.id || idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group relative aspect-square rounded-[2rem] overflow-hidden bg-slate-200 shadow-xl"
              >
                <img 
                  src={img.url} 
                  alt={img.caption || img.category} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                  <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">{img.category}</span>
                  <p className="text-white font-medium">{img.caption || "Community Impact"}</p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon size={32} />
            </div>
            <p className="text-slate-500 font-medium">No images found in this category.</p>
          </div>
        )}

        {/* Upload Modal */}
        <AnimatePresence>
          {showUpload && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowUpload(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-white w-full max-w-lg rounded-[2.5rem] p-8 md:p-10 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-8">
                  <h4 className="text-2xl font-bold text-slate-900">Add Gallery Image</h4>
                  <button onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleUpload} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Image URL</label>
                    <div className="flex gap-2">
                      <input 
                        type="url" 
                        required
                        value={newImage.url}
                        onChange={(e) => setNewImage({ ...newImage, url: e.target.value })}
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" 
                        placeholder="https://example.com/image.jpg" 
                      />
                      <button 
                        type="button"
                        onClick={generateAIImage}
                        disabled={generating}
                        className="px-4 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-2 disabled:opacity-50"
                        title="Generate with AI"
                      >
                        {generating ? <LoadingSpinner size={18} /> : <Sparkles size={18} />}
                      </button>
                    </div>
                    {newImage.url && (
                      <div className="mt-4 aspect-video rounded-xl overflow-hidden border border-slate-100">
                        <img src={newImage.url} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Category</label>
                    <select 
                      value={newImage.category}
                      onChange={(e) => setNewImage({ ...newImage, category: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400"
                    >
                      {categories.filter(c => c !== 'All').map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Caption (Optional)</label>
                    <input 
                      type="text" 
                      value={newImage.caption}
                      onChange={(e) => setNewImage({ ...newImage, caption: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" 
                      placeholder="Brief description..." 
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                  >
                    <Upload size={20} /> Upload to Gallery
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

const Hero = () => {
  return (
    <section id="home" className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-50 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-3xl opacity-60" />
      </div>

      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-6">
            <Hospital size={14} />
            Organized by SJM Healthcare
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold text-slate-900 leading-[1.1] mb-6">
            Healing Hands, <span className="text-emerald-600">Caring Hearts.</span>
          </h1>
          <p className="text-lg text-slate-600 mb-8 max-w-lg leading-relaxed">
            Dr. Pushpa Kaul NGO is dedicated to bridging the gap in healthcare accessibility. 
            Together with SJM Healthcare, we provide life-saving treatments and support to the underprivileged.
          </p>
            <div className="flex flex-wrap gap-4">
              <a 
                href="#donate"
                className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg hover:shadow-emerald-200 active:scale-95 hover:-translate-y-1"
              >
                Support Our Cause <ArrowRight size={20} />
              </a>
              <a 
                href="#about"
                className="bg-white border border-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 hover:-translate-y-1"
              >
                Learn More
              </a>
            </div>
          
          <div className="mt-12 flex items-center gap-6">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <img 
                  key={i}
                  src={`https://picsum.photos/seed/person${i}/100/100`} 
                  alt="Supporter"
                  className="w-12 h-12 rounded-full border-2 border-white object-cover"
                  referrerPolicy="no-referrer"
                />
              ))}
            </div>
            <div className="text-sm text-slate-500">
              <span className="font-bold text-slate-900">500+</span> Lives Impacted Monthly
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative"
        >
          <div className="relative z-10 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white">
            <img 
              src="https://picsum.photos/seed/healthcare/800/1000" 
              alt="Healthcare NGO"
              className="w-full aspect-[4/5] object-cover"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          </div>
          {/* Floating Card */}
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-6 -left-6 z-20 bg-white p-6 rounded-3xl shadow-xl border border-slate-100 max-w-[240px]"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                <Stethoscope size={20} />
              </div>
              <span className="font-bold text-slate-900">Medical Aid</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Providing free checkups and medicines to rural communities.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

const About = () => {
  return (
    <section id="about" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-3">Our Story</h2>
          <h3 className="text-4xl font-bold text-slate-900 mb-6">A Legacy of Care and Compassion</h3>
          <p className="text-slate-600 leading-relaxed">
            Founded under the vision of SJM Healthcare, Dr. Pushpa Kaul NGO was established to ensure that quality medical care is not a privilege, but a right. We combine professional medical expertise with a grassroots approach to serve those in need.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Hospital className="text-emerald-600" />,
              title: "Hospital Backing",
              desc: "Direct support from SJM Healthcare provides us with top-tier medical facilities and specialists."
            },
            {
              icon: <Users className="text-emerald-600" />,
              title: "Community First",
              desc: "We work directly with local leaders to identify and support the most vulnerable families."
            },
            {
              icon: <ShieldCheck className="text-emerald-600" />,
              title: "Transparent Giving",
              desc: "Every donation is tracked and utilized directly for patient care and community health programs."
            }
          ].map((item, i) => (
            <div key={i} className="bg-white p-8 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow border border-slate-100">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">
                {item.icon}
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h4>
              <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const DonationSection = () => {
  const { user } = useAuth();
  const [amount, setAmount] = useState<string>('1000');
  const [isRecurring, setIsRecurring] = useState(false);
  const [allocation, setAllocation] = useState('General Fund');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fundraisingGoal] = useState(500000); // Example goal: 5 Lakhs
  const [currentRaised, setCurrentRaised] = useState(325000); // Example raised: 3.25 Lakhs

  const handleDonate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: parseInt(amount),
          isRecurring,
          allocation,
          userId: user?.uid || 'anonymous',
          userEmail: user?.email || 'anonymous'
        }),
      });
      
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      setShowConfirm(false);
    }
  };

  const allocations = [
    'General Fund',
    'Child Healthcare',
    'Rural Health Camps',
    'Emergency Surgeries',
    'Maternal Health'
  ];

  const progress = (currentRaised / fundraisingGoal) * 100;

  return (
    <section id="donate" className="py-24" aria-labelledby="donation-title">
      <div className="max-w-7xl mx-auto px-6">
        <div className="bg-slate-900 rounded-[3rem] overflow-hidden relative">
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
            <img 
              src="https://picsum.photos/seed/giving/800/800" 
              alt="" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-slate-900" />
          </div>

          <div className="relative z-10 p-8 md:p-16 lg:p-24 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 id="donation-title" className="text-emerald-400 font-bold uppercase tracking-widest text-sm mb-4">Support Our Mission</h2>
              <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                Empower Communities Through Healthcare.
              </h3>
              <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                Your contribution directly funds our medical camps and subsidized treatments. Choose how you want to help and make a lasting impact.
              </p>
              
              {/* Progress Bar */}
              <div className="mb-10 space-y-4 max-w-md">
                <div className="flex justify-between items-end">
                  <span className="text-white font-bold text-sm uppercase tracking-wider">Fundraising Progress</span>
                  <span className="text-emerald-400 font-bold text-2xl">₹{currentRaised.toLocaleString()} <span className="text-slate-500 text-sm font-medium">/ ₹{fundraisingGoal.toLocaleString()}</span></span>
                </div>
                <div className="h-4 bg-white/10 rounded-full overflow-hidden border border-white/5" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <motion.div 
                    initial={{ width: 0 }}
                    whileInView={{ width: `${progress}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                  />
                </div>
                <p className="text-slate-500 text-xs italic">Help us reach our goal to fund 10 more medical camps this quarter.</p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 text-white/80">
                  <CheckCircle2 size={20} className="text-emerald-400" />
                  <span>Secure Stripe Payment Gateway</span>
                </div>
                <div className="flex items-center gap-3 text-white/80">
                  <CheckCircle2 size={20} className="text-emerald-400" />
                  <span>Monthly Recurring Options Available</span>
                </div>
                <div className="flex items-center gap-3 text-white/80">
                  <CheckCircle2 size={20} className="text-emerald-400" />
                  <span>Choose where your money goes</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative">
              <div className="flex justify-center mb-8">
                <div className="bg-slate-100 p-1 rounded-xl flex gap-1" role="radiogroup" aria-label="Donation frequency">
                  <button 
                    onClick={() => setIsRecurring(false)}
                    aria-checked={!isRecurring}
                    role="radio"
                    className={cn(
                      "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                      !isRecurring ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    One-time
                  </button>
                  <button 
                    onClick={() => setIsRecurring(true)}
                    aria-checked={isRecurring}
                    role="radio"
                    className={cn(
                      "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                      isRecurring ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Monthly
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label id="amount-label" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Amount</label>
                  <div className="grid grid-cols-3 gap-3 mb-4" role="radiogroup" aria-labelledby="amount-label">
                    {['500', '1000', '5000'].map((val) => (
                      <button
                        key={val}
                        onClick={() => setAmount(val)}
                        aria-checked={amount === val}
                        role="radio"
                        className={cn(
                          "py-3 rounded-xl font-bold transition-all border-2",
                          amount === val 
                            ? "bg-emerald-600 border-emerald-600 text-white" 
                            : "bg-white border-slate-100 text-slate-600 hover:border-emerald-200"
                        )}
                      >
                        ₹{val}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold" aria-hidden="true">₹</span>
                    <input 
                      type="number" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Custom Amount"
                      aria-label="Custom donation amount"
                      className="w-full pl-8 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:outline-none focus:border-emerald-400 font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label id="allocation-label" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Fund Allocation</label>
                  <select 
                    value={allocation}
                    onChange={(e) => setAllocation(e.target.value)}
                    aria-labelledby="allocation-label"
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:outline-none focus:border-emerald-400 font-bold text-slate-900 appearance-none cursor-pointer"
                  >
                    {allocations.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100" role="alert">
                    {error}
                  </div>
                )}

                <button 
                  onClick={() => setShowConfirm(true)}
                  disabled={loading || !amount || parseInt(amount) <= 0}
                  className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 hover:-translate-y-1"
                >
                  {loading ? "Processing..." : `Donate ₹${amount}${isRecurring ? '/mo' : ''}`}
                  {!loading && <ArrowRight size={20} />}
                </button>
              </div>
              
              <p className="text-center text-slate-400 text-xs mt-6">
                Secure payment powered by Stripe.
              </p>

              {/* Confirmation Dialog */}
              <AnimatePresence>
                {showConfirm && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => !loading && setShowConfirm(false)}
                      className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm rounded-[2.5rem] cursor-pointer"
                    />
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="relative bg-white w-full rounded-3xl p-8 shadow-2xl text-center"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="confirm-title"
                    >
                      <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck size={32} className="text-emerald-600" />
                      </div>
                      <h4 id="confirm-title" className="text-2xl font-bold text-slate-900 mb-2">Confirm Donation</h4>
                      <p className="text-slate-500 text-sm mb-6">Your contribution will directly support <span className="font-bold text-emerald-600">{allocation}</span>.</p>
                      
                      <div className="space-y-4 mb-8 text-left bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Amount:</span>
                          <span className="font-bold text-slate-900">₹{amount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Frequency:</span>
                          <span className="font-bold text-slate-900">{isRecurring ? 'Monthly' : 'One-time'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Allocation:</span>
                          <span className="font-bold text-slate-900">{allocation}</span>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <button 
                          onClick={handleDonate}
                          disabled={loading}
                          className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {loading ? <LoadingSpinner size={20} className="text-white" /> : "Confirm & Pay"}
                        </button>
                        <button 
                          onClick={() => setShowConfirm(false)}
                          disabled={loading}
                          className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Contact = () => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    try {
      // 1. Save to Firestore
      const submissionRef = collection(db, 'contact_submissions');
      await addDoc(submissionRef, {
        ...formData,
        submittedAt: Timestamp.now()
      });

      // 2. Call backend API (simulates email notification)
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      setStatus({ type: 'success', text: "Thank you! Your message has been sent successfully." });
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      console.error("Submission error:", error);
      setStatus({ type: 'error', text: "Failed to send message. Please try again later." });
    }
    setIsSubmitting(false);
  };

  return (
    <section id="contact" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-8">Get in Touch</h2>
            <div className="space-y-8">
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                  <MapPin size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Our Office</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    SJM Healthcare Campus, Sector 63,<br />
                    Noida, Uttar Pradesh 201301
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                  <Phone size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Phone</h4>
                  <p className="text-slate-600 text-sm">+91 120 456 7890</p>
                </div>
              </div>
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0">
                  <Mail size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Email</h4>
                  <p className="text-slate-600 text-sm">contact@drpushpakaulngo.org</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-slate-50 p-8 md:p-10 rounded-[2.5rem] border border-slate-100">
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" 
                  placeholder="John Doe" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" 
                  placeholder="john@example.com" 
                />
              </div>
            </div>
            <div className="space-y-2 mb-6">
              <label className="text-sm font-bold text-slate-700">Subject</label>
              <input 
                type="text" 
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" 
                placeholder="How can we help?" 
              />
            </div>
            <div className="space-y-2 mb-8">
              <label className="text-sm font-bold text-slate-700">Message</label>
              <textarea 
                rows={4} 
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" 
                placeholder="Your message..."
              ></textarea>
            </div>

            {status && (
              <div className={cn(
                "mb-6 p-4 rounded-xl text-sm font-medium",
                status.type === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              )}>
                {status.text}
              </div>
            )}

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <LoadingSpinner size={20} className="text-white" /> : "Send Message"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const path = `newsletter_subscribers/${email}`;
      await setDoc(doc(db, 'newsletter_subscribers', email), {
        email,
        subscribedAt: Timestamp.now()
      });
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 3000);
    } catch (error) {
      console.error("Subscription error:", error);
      // Fallback to localStorage if Firestore fails (e.g. permission error)
      const subscribers = JSON.parse(localStorage.getItem('newsletter_subscribers') || '[]');
      if (!subscribers.includes(email)) {
        subscribers.push(email);
        localStorage.setItem('newsletter_subscribers', JSON.stringify(subscribers));
      }
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="bg-slate-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-4 gap-12 mb-16">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
                <Heart size={24} fill="currentColor" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg leading-tight">Dr. Pushpa Kaul NGO</span>
                <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold">By SJM Healthcare</span>
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm mb-8">
              Dedicated to providing quality healthcare to the underserved. Join our mission to make healthcare a universal right.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-colors">
                <Facebook size={20} />
              </a>
              <a href="#" className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-colors">
                <Instagram size={20} />
              </a>
              <a href="#" className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-colors">
                <Twitter size={20} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-6">Quick Links</h4>
            <ul className="space-y-4 text-sm text-slate-400">
              <li><a href="#home" className="hover:text-emerald-400">Home</a></li>
              <li><a href="#about" className="hover:text-emerald-400">About Us</a></li>
              <li><a href="#programs" className="hover:text-emerald-400">Our Programs</a></li>
              <li><a href="#gallery" className="hover:text-emerald-400">Gallery</a></li>
              <li><a href="#faq" className="hover:text-emerald-400">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6">Newsletter</h4>
            <p className="text-slate-400 text-sm mb-4">Stay updated with our latest impact and activities.</p>
            <form onSubmit={handleSubscribe} className="space-y-3">
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-400 text-sm"
                required
              />
              <button 
                type="submit"
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all"
              >
                {subscribed ? "Subscribed!" : "Subscribe"}
              </button>
            </form>
          </div>
        </div>
        
        <div className="pt-12 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-500 text-xs border-t border-white/10">
          <p>© 2026 Dr. Pushpa Kaul NGO. All rights reserved.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-white">Privacy Policy</a>
            <a href="#" className="hover:text-white">Terms of Service</a>
          </div>
          <p>Managed by SJM Healthcare Group.</p>
        </div>
      </div>
    </footer>
  );
};

const Home = () => (
  <div id="home">
    <SEO />
    <Hero />
    <About />
    <MissionVision />
    <Programs />
    <Gallery />
    <FAQ />
    <DonationSection />
    <Contact />
    <CookieConsent />
    <Feedback />
  </div>
);

export default function App() {
  return (
    <HelmetProvider>
      <ErrorBoundary>
        <Router>
          <AuthProvider>
            <div className="min-h-screen bg-white font-sans selection:bg-emerald-100 selection:text-emerald-900">
              <VerificationBanner />
              <Navbar />
              <main>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route 
                    path="/profile" 
                    element={
                      <PrivateRoute>
                        <SEO title="My Profile" />
                        <UserProfile />
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/admin" 
                    element={
                      <AdminRoute>
                        <SEO title="Admin Dashboard" />
                        <AdminDashboard />
                      </AdminRoute>
                    } 
                  />
                </Routes>
              </main>
              <Footer />
            </div>
          </AuthProvider>
        </Router>
      </ErrorBoundary>
    </HelmetProvider>
  );
}
