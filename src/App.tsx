
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Trophy, Users, Calendar, Settings, 
  Plus, ChevronRight, LogOut, 
  Menu, X, Bell, User as UserIcon, 
  HardHat, ShieldCheck, Globe, 
  Zap, Cloud, CloudOff, RefreshCw, 
  AlertCircle, Download, Smartphone 
} from 'lucide-react';
import { 
  initializeApp, 
  getApps 
} from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  updateDoc,
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp, 
  writeBatch,
  increment,
  getDocFromServer
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';

import { 
  AppState, 
  ArcheryEvent, 
  UserRole, 
  TournamentSettings, 
  ParticipantRegistration, 
  RegistrationStatus, 
  User, 
  AppNotification, 
  GlobalSettings,
  ScoreEntry,
  ScoreLog,
  CategoryType,
  Archer
} from './types';
import { STORAGE_KEY, DEFAULT_GLOBAL_SETTINGS } from './constants';

// Clean imports for components
import LandingPage from './components/LandingPage';
import RegistrationPanel from './components/OnlineRegistration';
import AdminDashboard from './components/AdminDashboard';
import MemberDashboard from './components/MemberDashboard';
import AdminPanel from './components/AdminPanel';
import ScoringPanel from './components/ScoringPanel';
import LiveScoreboard from './components/LiveScoreboard';
import LoginPanel from './components/LoginPanel';
import ProfilePanel from './components/ProfilePanel';
import SuperAdminPanel from './components/SuperAdminPanel';
import TournamentCalendar from './components/TournamentCalendar';
import ArcusLogo from './components/ArcusLogo';
import ShareModal from './components/ShareModal';
import QuickScoringPanel from './components/QuickScoringPanel';
import OperatorCenter from './components/OperatorCenter';
import EliminationPanel from './components/EliminationPanel';
import ActivateTournament from './components/ActivateTournament';
import ResultsPanel from './components/ResultsPanel';
import FinancePanel from './components/FinancePanel';
import ArcherList from './components/ArcherList';
import OfficialList from './components/OfficialList';
import EventInfo from './components/EventInfo';
import ScorerLogin from './components/ScorerLogin';
import EntryList from './components/EntryList';
import IdCardEditor from './components/IdCardEditor';

import { auth, db } from './firebase';
const googleProvider = new GoogleAuthProvider();

export default function App() {
  const [view, setView] = useState<string>('LANDING');
  // @ts-ignore
  const dummy: 'ACTIVATE_TOURNAMENT' | 'MEMBER_DASHBOARD' = 'ACTIVATE_TOURNAMENT';
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [appState, setAppState] = useState<AppState>({
    events: [],
    users: [],
    notifications: [],
    globalSettings: DEFAULT_GLOBAL_SETTINGS,
    currentUser: null,
    activeEventId: null,
    isDataLoaded: false
  });

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [activatingEventId, setActivatingEventId] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [shareData, setShareData] = useState<{isOpen: boolean, url: string, name: string, registerUrl?: string}>({
    isOpen: false,
    url: '',
    name: ''
  });
  
  const [isCheckingLink, setIsCheckingLink] = useState(true);
  const isSyncingFromCloud = useRef(false);
  const isCurrentlySyncing = useRef(false);
  const [deletedEventIds, setDeletedEventIds] = useState<Set<string>>(new Set());

  const appStateRef = useRef(appState);
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  // Keep track of participant IDs we've already seen during the current event session
  const seenRegistrantIdsRef = useRef<Record<string, Set<string>>>({});

  // Audio utility to play a gentle notification sound
  const playBellSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      // Dual-tone chime: G5 (783.99 Hz) -> C6 (1046.50 Hz)
      const playNote = (freq: number, startTime: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      const now = audioCtx.currentTime;
      playNote(783.99, now, 0.15);
      playNote(1046.50, now + 0.1, 0.32);
    } catch (err) {
      console.warn("Could not play notification sound:", err);
    }
  };

  // Catch-all to hide splash screen if loading hangs
  useEffect(() => {
    const timer = setTimeout(() => setIsSplashVisible(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const pushNotification = (title: string, message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' = 'INFO') => {
    const id = Date.now().toString();
    const newNotif: AppNotification = { 
      id, 
      title, 
      message, 
      type: type === 'ERROR' as any ? 'WARNING' : type, 
      timestamp: Date.now(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 5));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // 1. Initial Data Load (Local + Cloud)
  useEffect(() => {
    const loadInitialData = async () => {
      // 1. Load Local Storage
      const localData = localStorage.getItem(STORAGE_KEY);
      let skipCloudFetch = false;

      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          setAppState(prev => ({ 
            ...prev, 
            ...parsed, 
            isDataLoaded: true // Show cached data immediately
          }));

          const cacheTimestamp = localStorage.getItem(`${STORAGE_KEY}_timestamp`);
          if (cacheTimestamp) {
            const age = Date.now() - parseInt(cacheTimestamp);
            const CACHE_MAX_AGE = 60 * 1000; // 60 seconds of complete relaxation
            if (age < CACHE_MAX_AGE) {
              skipCloudFetch = true;
              console.log(`[LOCAL-CACHE] Data masih segar (${Math.round(age / 1000)} detik). Menghindari fetch cloud.`);
            }
          }
        } catch (e) {
          console.error("Local storage corrupted", e);
        }
      }

      // 2. Load Cloud Data (Direct Fetch)
      if (isOnline && db && !skipCloudFetch) {
        try {
          await fetchCloudData();
        } catch (err: any) {
          console.warn("Cloud data fetch failed, continuing with local state", err.message);
          if (err.message?.includes('quota exceeded')) {
            setQuotaExceeded(true);
            pushNotification("Quota Firestore Habis", "Limit harian tercapai. Mode offline aktif.", "WARNING");
          }
        }
      }
      
      setAppState(prev => ({ ...prev, isDataLoaded: true }));
      setIsCheckingLink(false);

      // 3. Process Tournaments/Event link from URL query params (e.g., ?event=EVENT_ID)
      const params = new URLSearchParams(window.location.search);
      const urlEventId = params.get('event');
      if (urlEventId) {
        console.log(`[URL-ROUTING] Menemukan parameter event=${urlEventId} di URL, melompat ke info turnamen...`);
        setAppState(prev => ({ ...prev, activeEventId: urlEventId }));
        setView('PUBLIC_EVENT_INFO');
      }
      
      // Force hide splash screen after a small delay to allow initial render
      setTimeout(() => {
        setIsSplashVisible(false);
      }, 500);
    };

    loadInitialData();
  }, []);

  // 2. Authentication & Real-time Subscriptions
  useEffect(() => {
    if (!auth || !db) return;
    
    let unsubUserEvents: (() => void) | null = null;
    let unsubPublicEvents: (() => void) | null = null;

    // A. Global Public Events Listener (always active)
    const publicQ = query(
      collection(db, 'events'),
      limit(200)
    );
    
    unsubPublicEvents = onSnapshot(publicQ, (snapshot) => {
      const publicEvents = snapshot.docs.map(doc => {
        const d = doc.data();
        const base = d.data || d;
        const settings = {
           ...(base.settings || base || {}),
           ...(d.settings || {})
         };
        return { 
          ...base, 
          ...d,
          id: doc.id, 
          settings,
          status: (d.status || base.status || 'DRAFT').toString().toUpperCase() 
        } as ArcheryEvent;
      }).filter(e => e.status !== 'DELETED' && (e.settings?.isActivated === true || e.status === 'UPCOMING' || e.status === 'ONGOING'));

      setAppState(prev => {
        const eventMap = new Map(prev.events.map(e => [e.id, e]));
        publicEvents.forEach(pe => {
          const existing = eventMap.get(pe.id);
          const keepDetailed = existing?.isDetailedLoaded;
          eventMap.set(pe.id, {
            ...(existing || {}),
            ...pe,
            settings: { ...(existing?.settings || {}), ...pe.settings } as any,
            registrations: keepDetailed ? existing.registrations : (existing?.registrations?.length ? existing.registrations : (pe.registrations || [])),
            archers: keepDetailed ? existing.archers : (existing?.archers?.length ? existing.archers : (pe.archers || [])),
            officials: keepDetailed ? existing.officials : (existing?.officials?.length ? existing.officials : (pe.officials || [])),
            isDetailedLoaded: keepDetailed || false
          });
        });
        
        // Remove events that are no longer in the filtered set if they were marked as DELETED
        const activeIds = new Set(publicEvents.map(e => e.id));
        // We only remove if we're sure it's deleted (not just because it's not in this specific snapshot)
        // Actually, simple filtering is enough since we're using a Map.
        
        return { 
          ...prev, 
          events: Array.from(eventMap.values()).filter(e => e.status !== 'DELETED') 
        };
      });
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const docRef = doc(db, 'profiles', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        let userData: User;

        if (docSnap.exists()) {
          const d = docSnap.data();
          userData = { ...(d.data || d), id: firebaseUser.uid };
        } else {
          const isAdmin = ['poedji.sugianto@gmail.com', 'admin@arcus.id'].includes(firebaseUser.email || '');
          userData = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'User',
            role: isAdmin ? UserRole.SUPERADMIN : UserRole.PARTICIPANT,
            photoURL: firebaseUser.photoURL || undefined
          };
          await setDoc(docRef, userData);
        }

        setAppState(prev => ({ ...prev, currentUser: userData }));
        
        // B. Subscribe to user-owned events
        if (unsubUserEvents) unsubUserEvents();
        const userQ = query(
          collection(db, 'events'),
          where('ownerId', 'in', [userData.id, userData.email].filter(Boolean))
        );
        
        unsubUserEvents = onSnapshot(userQ, (snapshot) => {
          const userEvents = snapshot.docs.map(doc => {
            const d = doc.data();
            const base = d.data || d;
            const settings = {
               ...(base.settings || base || {}),
               ...(d.settings || {})
            };
            return { 
              ...base, 
              ...d,
              id: doc.id, 
              settings,
              status: (d.status || base.status || 'DRAFT').toString().toUpperCase() 
            } as ArcheryEvent;
          }).filter(e => e.status !== 'DELETED');
          
          setAppState(prev => {
            const eventMap = new Map(prev.events.map(e => [e.id, e]));
            userEvents.forEach(ue => {
              const existing = eventMap.get(ue.id);
              const keepDetailed = existing?.isDetailedLoaded;
              eventMap.set(ue.id, {
                ...(existing || {}),
                ...ue,
                settings: { ...(existing?.settings || {}), ...ue.settings } as any,
                registrations: keepDetailed ? existing.registrations : (existing?.registrations?.length ? existing.registrations : (ue.registrations || [])),
                archers: keepDetailed ? existing.archers : (existing?.archers?.length ? existing.archers : (ue.archers || [])),
                officials: keepDetailed ? existing.officials : (existing?.officials?.length ? existing.officials : (ue.officials || [])),
                isDetailedLoaded: keepDetailed || false
              });
            });
            return { ...prev, events: Array.from(eventMap.values()).filter(e => e.status !== 'DELETED') };
          });
        });

        fetchCloudData(userData);
      } else {
        if (unsubUserEvents) unsubUserEvents();
        setAppState(prev => ({ ...prev, currentUser: null }));
        fetchCloudData();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUserEvents) unsubUserEvents();
      if (unsubPublicEvents) unsubPublicEvents();
    };
  }, [db]);

  // 3. Active Event & Data Subscriptions
  useEffect(() => {
    if (!db || !appState.activeEventId) return;

    const eventId = appState.activeEventId;
    const isGuest = !appState.currentUser && !appState.activeScorer;

    let unsubActiveEventDoc = () => {};
    let unsubSubmissions = () => {};
    let unsubScores = () => {};
    let unsubScoreLogs = () => {};

    // 1. ALWAYS warm up / fetch detailed event records from our server-side API first (bypasses Firestore Security Rule & indexing errors)
    const fetchDataViaAPI = async () => {
      try {
        console.log(`[API-LOAD] Fetching event details for event: ${eventId} via server API...`);
        const res = await fetch(`/api/event-details/${eventId}`);
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.data) {
            const evData = body.data;
            
            // Correctly flatten each submission, mapping nested properties to the root level
            const rawSubmissions = (evData.registrations || []).map((s: any) => {
              const base = s.archerData || s.officialData || s.participantData || s.data || s;
              const regType = s.regType || base.regType || (s.category === 'OFFICIAL' ? 'OFFICIAL' : 'ARCHER');
              return { ...base, ...s, regType };
            });
            
            const cloudArchers = rawSubmissions.filter((s: any) => s.regType !== 'OFFICIAL');
            const cloudOfficials = rawSubmissions.filter((s: any) => s.regType === 'OFFICIAL');
            const cloudScores = evData.scores || [];
            const cloudScoreLogs = evData.scoreLogs || [];

            setAppState(prev => {
              if (prev.activeEventId !== eventId) return prev;
              
              const exists = prev.events.some(e => e.id === eventId);
              let updatedEvents;
              
              if (exists) {
                updatedEvents = prev.events.map(e => {
                  if (e.id === eventId) {
                    const fallbackArchers = cloudArchers.length ? cloudArchers : (evData.archers || e.archers || []);
                    const fallbackOfficials = cloudOfficials.length ? cloudOfficials : (evData.officials || e.officials || []);
                    const fallbackRegistrations = rawSubmissions.length ? rawSubmissions : (evData.registrations || e.registrations || []);

                    return {
                      ...e,
                      ...evData,
                      registrations: fallbackRegistrations,
                      archers: fallbackArchers,
                      officials: fallbackOfficials,
                      registrationCount: fallbackRegistrations.length || fallbackArchers.length || e.registrationCount || 0,
                      scores: cloudScores.length ? cloudScores : (e.scores || []),
                      scoreLogs: cloudScoreLogs.length ? cloudScoreLogs : (e.scoreLogs || []),
                      isDetailedLoaded: true
                    };
                  }
                  return e;
                });
              } else {
                const fallbackArchers = cloudArchers.length ? cloudArchers : (evData.archers || []);
                const fallbackOfficials = cloudOfficials.length ? cloudOfficials : (evData.officials || []);
                const fallbackRegistrations = rawSubmissions.length ? rawSubmissions : (evData.registrations || []);

                const newEvent = {
                  ...evData,
                  id: eventId,
                  registrations: fallbackRegistrations,
                  archers: fallbackArchers,
                  officials: fallbackOfficials,
                  registrationCount: fallbackRegistrations.length || fallbackArchers.length || 0,
                  scores: cloudScores,
                  scoreLogs: cloudScoreLogs,
                  isDetailedLoaded: true
                };
                updatedEvents = [newEvent, ...prev.events];
              }
              
              return { ...prev, events: updatedEvents };
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch event details via API:", err);
      }
    };

    fetchDataViaAPI();

    // 2. Bind real-time listeners directly to Firestore for everyone (both guests and authenticated managers)
    // This connects directly to the database for instant, 100% accurate participant/score updates.
    if (db) {
      console.log(`[REALTIME-SYNC] Binding direct Firestore real-time listeners for event: ${eventId}`);
      
      unsubActiveEventDoc = onSnapshot(doc(db, 'events', eventId), (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        const base = d.data || d;
        const settings = {
          ...(base.settings || base || {}),
          ...(d.settings || {})
        };
        const parentEvent = {
          ...base,
          ...d,
          id: snap.id,
          settings,
          status: (d.status || base.status || 'DRAFT').toString().toUpperCase()
        };

        setAppState(prev => {
          if (prev.activeEventId !== eventId) return prev;
          const exists = prev.events.some(e => e.id === eventId);
          let updatedEvents;
          if (exists) {
            updatedEvents = prev.events.map(e => {
              if (e.id === eventId) {
                const mergedArchers = Array.from(
                  new Map([
                    ...(e.archers || []).map(a => [a.id, a] as [string, Archer]),
                    ...(parentEvent.archers || []).map(a => [a.id, a] as [string, Archer])
                  ]).values()
                );
                const mergedOfficials = Array.from(
                  new Map([
                    ...(e.officials || []).map(o => [o.id, o] as [string, any]),
                    ...(parentEvent.officials || []).map(o => [o.id, o] as [string, any])
                  ]).values()
                );
                const mergedRegistrations = Array.from(
                  new Map([
                    ...(e.registrations || []).map(r => [r.id, r] as [string, any]),
                    ...(parentEvent.registrations || []).map(r => [r.id, r] as [string, any])
                  ]).values()
                );

                return {
                  ...parentEvent,
                  ...e,
                  settings: { ...(parentEvent.settings || {}), ...(e.settings || {}) },
                  registrations: mergedRegistrations,
                  archers: mergedArchers,
                  officials: mergedOfficials,
                  status: parentEvent.status as any
                };
              }
              return e;
            });
          } else {
            updatedEvents = [
              {
                ...parentEvent,
                registrations: [],
                archers: [],
                officials: [],
                scores: [],
                scoreLogs: [],
                isDetailedLoaded: false
              } as any,
              ...prev.events
            ];
          }
          return { ...prev, events: updatedEvents };
        });
      }, (err) => {
        console.warn("ActiveEventDoc realtime subscription warning (possible rule restriction on client):", err.message);
      });

      unsubSubmissions = onSnapshot(collection(db, 'events', eventId, 'submissions'), (snapshot) => {
        const rawSubmissions = snapshot.docs.map(sd => {
          const d = sd.data();
          const base = d.archerData || d.officialData || d.participantData || d.data || d;
          const regType = d.regType || base.regType || (d.category === 'OFFICIAL' ? 'OFFICIAL' : 'ARCHER');
          return { ...base, ...d, id: sd.id, regType };
        });

        // Track and alert when a new registration is submitted reactive to database mutations:
        if (!seenRegistrantIdsRef.current[eventId]) {
          // Initialize list with current database registrations to avoid backfilling notices on startup
          seenRegistrantIdsRef.current[eventId] = new Set(rawSubmissions.map(s => s.id));
        } else {
          const seenSet = seenRegistrantIdsRef.current[eventId];
          const newEntries = rawSubmissions.filter(s => !seenSet.has(s.id));

          if (newEntries.length > 0) {
            // Play notification chime
            playBellSound();

            if (newEntries.length > 3) {
              pushNotification(
                "Pendaftar Baru Masuk",
                `Ada ${newEntries.length} pendaftar baru yang terdaftar ke database!`,
                "SUCCESS"
              );
              newEntries.forEach(s => seenSet.add(s.id));
            } else {
              newEntries.forEach(s => {
                const categoryLabel = s.regType === 'OFFICIAL' 
                  ? 'OFFICIAL' 
                  : (s.category || 'Atlit');
                pushNotification(
                  "Pendaftaran Baru!",
                  `${s.name} terdaftar (${categoryLabel})`,
                  "SUCCESS"
                );
                seenSet.add(s.id);
              });
            }
          }
        }
        
        const cloudArchers = rawSubmissions.filter(s => s.regType !== 'OFFICIAL');
        const cloudOfficials = rawSubmissions.filter(s => s.regType === 'OFFICIAL');

        setAppState(prev => {
          if (prev.activeEventId !== eventId) return prev;
          const exists = prev.events.some(e => e.id === eventId);
          let updatedEvents;

          if (exists) {
            updatedEvents = prev.events.map(e => {
              if (e.id === eventId) {
                // Protect against empty snapshot race conditions wiping out valid loaded data
                const finalSubmissions = rawSubmissions.length > 0 
                  ? rawSubmissions 
                  : (e.registrations && e.registrations.length > 0 ? e.registrations : []);
                const finalArchers = cloudArchers.length > 0 
                  ? cloudArchers 
                  : (e.archers && e.archers.length > 0 ? e.archers : []);
                const finalOfficials = cloudOfficials.length > 0 
                  ? cloudOfficials 
                  : (e.officials && e.officials.length > 0 ? e.officials : []);

                return {
                  ...e,
                  registrations: finalSubmissions,
                  archers: finalArchers,
                  officials: finalOfficials,
                  registrationCount: finalSubmissions.length || (e.registrationCount || 0),
                  isDetailedLoaded: true
                };
              }
              return e;
            });
          } else {
            const newEvent = {
              id: eventId,
              settings: { tournamentName: "Memuat Turnamen..." } as any,
              registrations: rawSubmissions,
              archers: cloudArchers,
              officials: cloudOfficials,
              registrationCount: rawSubmissions.length,
              scores: [],
              scoreLogs: [],
              isDetailedLoaded: true
            } as any;
            updatedEvents = [newEvent, ...prev.events];
          }
          return { ...prev, events: updatedEvents };
        });
      }, (err) => {
        console.warn("Submissions realtime subscription warning (possible rule restriction on client):", err.message);
      });

      unsubScores = onSnapshot(collection(db, 'events', eventId, 'scores'), (snapshot) => {
        const rawScores = snapshot.docs.map(sd => {
          const d = sd.data();
          return { ...d, id: sd.id } as any;
        });

        setAppState(prev => {
          if (prev.activeEventId !== eventId) return prev;
          const newEvents = prev.events.map(e => {
            if (e.id === eventId) {
              return {
                ...e,
                scores: rawScores
              };
            }
            return e;
          });
          return { ...prev, events: newEvents };
        });
      }, (err) => {
        console.warn("Scores realtime subscription warning:", err.message);
      });

      unsubScoreLogs = onSnapshot(collection(db, 'events', eventId, 'scoreLogs'), (snapshot) => {
        const rawLogs = snapshot.docs.map(sd => {
          const d = sd.data();
          return { ...d, id: sd.id } as any;
        });

        setAppState(prev => {
          if (prev.activeEventId !== eventId) return prev;
          const newEvents = prev.events.map(e => {
            if (e.id === eventId) {
              return {
                ...e,
                scoreLogs: rawLogs
              };
            }
            return e;
          });
          return { ...prev, events: newEvents };
        });
      }, (err) => {
        console.warn("ScoreLogs realtime subscription warning:", err.message);
      });
    }

    return () => {
      unsubActiveEventDoc();
      unsubSubmissions();
      unsubScores();
      unsubScoreLogs();
    };
  }, [db, appState.activeEventId, appState.currentUser, appState.activeScorer]);

  // 4. SuperAdmin Subscriptions
  useEffect(() => {
    if (!db || appState.currentUser?.role !== UserRole.SUPERADMIN) return;

    const unsubProfiles = onSnapshot(collection(db, 'profiles'), (snapshot) => {
      const users = snapshot.docs.map(d => {
        const data = d.data();
        return data.data || data;
      });
      setAppState(prev => ({ ...prev, users }));
    });

    return () => unsubProfiles();
  }, [db, appState.currentUser?.role]);

  // 5. Auto-persistence to LocalStorage to save quota on repeated loads/refreshes
  useEffect(() => {
    if (appState.isDataLoaded && appState.events.length > 0) {
      try {
        const stateToSave = {
          globalSettings: appState.globalSettings,
          events: appState.events
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        localStorage.setItem(`${STORAGE_KEY}_timestamp`, Date.now().toString());
      } catch (err) {
        console.warn("Could not save state to localStorage", err);
      }
    }
  }, [appState.events, appState.globalSettings, appState.isDataLoaded]);

  const fetchCloudData = async (userOverride?: User) => {
    if (!db || !isOnline || quotaExceeded) return;
    
    try {
      // 1. Fetch Global Settings
      const settingsSnap = await getDoc(doc(db, 'systemConfigs', 'global'));
      let cloudSettings = DEFAULT_GLOBAL_SETTINGS;
      if (settingsSnap.exists()) {
        const d = settingsSnap.data();
        cloudSettings = d.data || d;
      }

      const currentUser = userOverride || appStateRef.current.currentUser;
      let cloudEvents: ArcheryEvent[] = [];
      
      // Fetch public events primarily via API (faster)
      try {
        const res = await fetch('/api/public-events');
        if (res.ok) {
           const data = await res.json();
           cloudEvents = (data.events || []).map((e: any) => {
             const base = e.data || e;
             const settings = {
                ...(base.settings || base || {}),
                ...(e.settings || {})
             };
             return { 
               ...base, 
               ...e, 
               settings,
               status: (e.status || base.status || 'DRAFT').toString().toUpperCase() 
             };
           });
        }
      } catch (apiErr) {
        // Fallback to minimal public fetch
        const eventsSnap = await getDocs(query(collection(db, 'events'), limit(30)));
        cloudEvents = eventsSnap.docs.map(doc => {
          const d = doc.data();
          const base = d.data || d;
          const settings = {
             ...(base.settings || base || {}),
             ...(d.settings || {})
          };
          return { ...base, ...d, id: doc.id, settings, status: (d.status || base.status || 'DRAFT').toString().toUpperCase() } as ArcheryEvent;
        });
      }
      
      setAppState(prev => {
        const eventMap = new Map(prev.events.map(e => [e.id, e]));

        // Upsert cloud events
        cloudEvents.forEach(ce => {
          const existing = eventMap.get(ce.id);
          const keepDetailed = existing?.isDetailedLoaded;
          
          const mergedSettings = {
            ...(existing?.settings || {}),
            ...(ce.settings || {})
          };

          eventMap.set(ce.id, {
            ...(existing || {}),
            ...ce,
            settings: mergedSettings as any,
            registrations: keepDetailed ? existing.registrations : (ce.registrations?.length ? ce.registrations : (existing?.registrations || [])),
            archers: keepDetailed ? existing.archers : (ce.archers?.length ? ce.archers : (existing?.archers || [])),
            officials: keepDetailed ? existing.officials : (ce.officials?.length ? ce.officials : (existing?.officials || [])),
            isDetailedLoaded: keepDetailed || false,
            status: (ce.status || existing?.status || 'DRAFT').toUpperCase() as ArcheryEvent['status']
          });
        });

        return {
          ...prev,
          globalSettings: {
            ...cloudSettings,
            paymentGatewayProvider: (cloudSettings.paymentGatewayProvider as any) || 'NONE'
          } as GlobalSettings,
          events: Array.from(eventMap.values()).filter(e => e.status !== 'DELETED'),
          isDataLoaded: true
        };
      });

    } catch (err: any) {
      console.error("Cloud fetch failed:", err.message);
    }
  };

  const refreshActiveEventDetails = async (bypassCache = false) => {
    if (!appState.activeEventId) return;
    
    const eventId = appState.activeEventId;
    const isGuest = !appState.currentUser && !appState.activeScorer;
    
    console.log(`[REFRESH] Memulai refresh data turnamen (BypassCache: ${bypassCache}, isGuest: ${isGuest})`);
    setIsSyncing(true);
    
    try {
      if (isGuest) {
        const url = `/api/event-details/${eventId}${bypassCache ? '?bypassCache=true' : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.data) {
            const evData = body.data;
            
            const rawSubmissions = (evData.registrations || []).map((s: any) => {
              const base = s.archerData || s.officialData || s.participantData || s.data || s;
              const regType = s.regType || base.regType || (s.category === 'OFFICIAL' ? 'OFFICIAL' : 'ARCHER');
              return { ...base, ...s, regType };
            });
            
            const cloudArchers = rawSubmissions.filter((s: any) => s.regType !== 'OFFICIAL');
            const cloudOfficials = rawSubmissions.filter((s: any) => s.regType === 'OFFICIAL');
            const cloudScores = evData.scores || [];
            const cloudScoreLogs = evData.scoreLogs || [];

            setAppState(prev => {
              if (prev.activeEventId !== eventId) return prev;
              
              const exists = prev.events.some(e => e.id === eventId);
              let updatedEvents;
              
              if (exists) {
                updatedEvents = prev.events.map(e => {
                  if (e.id === eventId) {
                    return {
                      ...e,
                      ...evData,
                      registrations: rawSubmissions,
                      archers: cloudArchers,
                      officials: cloudOfficials,
                      registrationCount: rawSubmissions.length,
                      scores: cloudScores,
                      scoreLogs: cloudScoreLogs,
                      isDetailedLoaded: true
                    };
                  }
                  return e;
                });
              } else {
                const newEvent = {
                  ...evData,
                  id: eventId,
                  registrations: rawSubmissions,
                  archers: cloudArchers,
                  officials: cloudOfficials,
                  registrationCount: rawSubmissions.length,
                  scores: cloudScores,
                  scoreLogs: cloudScoreLogs,
                  isDetailedLoaded: true
                };
                updatedEvents = [newEvent, ...prev.events];
              }
              
              return { ...prev, events: updatedEvents };
            });
            if (bypassCache) {
              pushNotification("Data Terbaru", "Daftar peserta telah diperbarui dengan data cloud terbaru.", "SUCCESS");
            }
          }
        } else {
          throw new Error("Gagal mengambil data dari API.");
        }
      } else {
        await syncCloudData(true);
        // Force trigger fetch for admin as well to make sure everything is perfect
        const url = `/api/event-details/${eventId}${bypassCache ? '?bypassCache=true' : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.data) {
            const evData = body.data;
            const rawSubmissions = (evData.registrations || []).map((s: any) => {
              const base = s.archerData || s.officialData || s.participantData || s.data || s;
              const regType = s.regType || base.regType || (s.category === 'OFFICIAL' ? 'OFFICIAL' : 'ARCHER');
              return { ...base, ...s, regType };
            });
            const cloudArchers = rawSubmissions.filter((s: any) => s.regType !== 'OFFICIAL');
            const cloudOfficials = rawSubmissions.filter((s: any) => s.regType === 'OFFICIAL');
            
            setAppState(prev => {
              const updatedEvents = prev.events.map(e => {
                if (e.id === eventId) {
                  return {
                    ...e,
                    ...evData,
                    registrations: rawSubmissions,
                    archers: cloudArchers,
                    officials: cloudOfficials,
                    registrationCount: rawSubmissions.length,
                    isDetailedLoaded: true
                  };
                }
                return e;
              });
              return { ...prev, events: updatedEvents };
            });
          }
        }
      }
    } catch (err: any) {
      console.error("Gagal melakukan refresh:", err);
      pushNotification("Gagal Refresh", err.message || "Gagal menghubungi server.", "WARNING");
    } finally {
      setIsSyncing(false);
    }
  };

  const syncCloudData = async (manual = false, overrideState?: AppState) => {
    const state = overrideState || appStateRef.current;
    if (!db || !isOnline || (!state?.currentUser && !state?.activeScorer)) return;
    if (!hasPendingChanges && !manual && !overrideState) return;
    
    if (isCurrentlySyncing.current) return;
    isCurrentlySyncing.current = true;
    setIsSyncing(true);

    try {
      // 1. Sync Global Settings
      if (state.currentUser?.role === UserRole.SUPERADMIN) {
        await setDoc(doc(db, 'systemConfigs', 'global'), { 
          id: 'global', 
          data: state.globalSettings, 
          updatedAt: serverTimestamp() 
        }, { merge: true });
      }

      // 2. Sync User Profile
      if (state.currentUser) {
        await setDoc(doc(db, 'profiles', state.currentUser.id), { 
          id: state.currentUser.id, 
          data: state.currentUser, 
          updatedAt: serverTimestamp() 
        }, { merge: true });
      }

      setHasPendingChanges(false);
      setLastSync(new Date());
      if (manual) pushNotification("Sinkronisasi Selesai", "Data berhasil diperbarui.", "SUCCESS");
    } catch (err: any) {
      console.error("Sync error:", err);
      if (manual) pushNotification("Gagal Sinkron", err.message, "WARNING");
    } finally {
      setIsSyncing(false);
      isCurrentlySyncing.current = false;
    }
  };

  const onLoginSuccess = (user: User) => {
    setAppState(prev => ({ ...prev, currentUser: user }));
    setView('MEMBER_DASHBOARD');
    pushNotification("Selamat Datang", `Halo, ${user.name}!`, "SUCCESS");
    syncCloudData(true);
  };

  const handleLogout = async () => {
    if (auth) await signOut(auth);
    setAppState(prev => ({ ...prev, currentUser: null, activeEventId: null, activeScorer: null }));
    setView('LANDING');
  };

  const handleActivateEvent = (eventId: string, targetPhone?: string) => {
    const event = appState.events.find(e => e.id === eventId);
    if (!event) return;

    // Generate 4-digit code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setActivationCode(code);
    setActivatingEventId(eventId);

    const currentUser = appState.currentUser;
    const phone = targetPhone || currentUser?.phone;

    // Send via email
    fetch('/api/send-email-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: currentUser?.email || 'admin@arcus.id',
        subject: `Kode Aktivasi Turnamen: ${event.settings.tournamentName}`,
        message: `Halo ${currentUser?.name || 'User'},\n\nKode aktivasi Anda untuk turnamen "${event.settings.tournamentName}" adalah: ${code}\n\nMasukkan kode ini di aplikasi untuk melakukan aktivasi.`
      })
    })
    .then(async (res) => {
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json() : null;
      
      if (!res.ok) {
        throw new Error(data?.message || `Server error (${res.status})`);
      }
      return data;
    })
    .then(data => {
      if (data.isSimulated && data.otp) {
        pushNotification('Mode Simulasi', `SMTP tidak aktif. Kode: ${data.otp}`, 'INFO');
      } else {
        pushNotification('Email Dikirim', 'Cek kotak masuk atau spam.', 'SUCCESS');
      }
    })
    .catch((err) => {
      console.error('OTP Email Error:', err);
    });

    // Send via WhatsApp if phone exists
    if (phone) {
      fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone,
          message: `*KODE AKTIVASI ARCUS*\n\nHalo ${currentUser?.name || 'User'},\n\nKode aktivasi Anda untuk turnamen *${event.settings.tournamentName}* adalah:\n\n*${code}*\n\nMasukkan kode ini di aplikasi untuk mengaktifkan turnamen.\n\n_Salam Arcus Archery_`
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          pushNotification('WhatsApp Dikirim', 'Kode aktivasi telah dikirim ke WA.', 'SUCCESS');
        } else {
          console.error('WA Send Error:', data);
          if (!currentUser?.phone) {
             pushNotification('WA Gagal', 'Nomor telepon tidak valid atau token Fonnte belum diset.', 'WARNING');
          }
        }
      })
      .catch(err => console.error('WA Fetch Error:', err));
    }

    setView('ACTIVATE_TOURNAMENT');
  };

  const handleUpdateEvent = async (id: string, updated: Partial<ArcheryEvent>) => {
    setAppState(prev => {
      const existingEvent = prev.events.find(e => e.id === id);
      if (!existingEvent) return prev;

      // Deep-ish merge for settings
      const newSettings = updated.settings 
        ? { ...existingEvent.settings, ...updated.settings }
        : existingEvent.settings;

      // De-duplicate scores by archerId + sessionId + endIndex
      let newScores = existingEvent.scores || [];
      if (updated.scores) {
        const updatedMap = new Map(updated.scores.map(s => [`${s.archerId}_${s.sessionId || 'QUAL'}_${s.endIndex}`, s]));
        newScores = [
          ...newScores.filter(s => !updatedMap.has(`${s.archerId}_${s.sessionId || 'QUAL'}_${s.endIndex}`)),
          ...updated.scores
        ];
      }

      let newScoreLogs = existingEvent.scoreLogs || [];
      if (updated.scoreLogs) {
        const logsMap = new Map(updated.scoreLogs.map(l => [l.id || `${l.archerId}_${l.timestamp}`, l]));
        newScoreLogs = [
          ...newScoreLogs.filter(l => !logsMap.has(l.id || `${l.archerId}_${l.timestamp}`)),
          ...updated.scoreLogs
        ];
      }

      const newEvent = { 
        ...existingEvent, 
        ...updated, 
        settings: newSettings,
        scores: newScores,
        scoreLogs: newScoreLogs,
        updatedAt: new Date().toISOString() 
      };

      return {
        ...prev,
        events: prev.events.map(e => e.id === id ? newEvent : e)
      };
    });
    
    if (isOnline && db) {
      try {
        // Create a flattened update object for Firestore to avoid overwriting nested objects
        const firestoreUpdate: any = {
          ...updated,
          updatedAt: serverTimestamp()
        };

        // scores and scoreLogs are written to individual subcollections, remove from main document
        delete firestoreUpdate.scores;
        delete firestoreUpdate.scoreLogs;

        // If settings are provided, flatten them for Firestore merge
        if (updated.settings) {
          delete firestoreUpdate.settings;
          Object.entries(updated.settings).forEach(([key, val]) => {
            firestoreUpdate[`settings.${key}`] = val;
          });
        }

        // Write scores as individual subcollection docs to prevent lag and delay
        if (updated.scores && Array.isArray(updated.scores)) {
          const { writeBatch } = await import('firebase/firestore');
          const batch = writeBatch(db);
          updated.scores.forEach(score => {
            if (score && score.archerId) {
              const scoreId = `${score.archerId}_${score.sessionId || 'QUAL'}_${score.endIndex || 0}`;
              const scoreRef = doc(db, 'events', id, 'scores', scoreId);
              batch.set(scoreRef, score, { merge: true });
            }
          });
          await batch.commit();
        }

        // Write scoreLogs as individual subcollection docs
        if (updated.scoreLogs && Array.isArray(updated.scoreLogs)) {
          const { writeBatch } = await import('firebase/firestore');
          const batch = writeBatch(db);
          updated.scoreLogs.forEach(log => {
            if (log && log.archerId) {
              const logId = log.id || `${log.archerId}_${log.timestamp || Date.now()}`;
              const logRef = doc(db, 'events', id, 'scoreLogs', logId);
              batch.set(logRef, log, { merge: true });
            }
          });
          await batch.commit();
        }

        await updateDoc(doc(db, 'events', id), firestoreUpdate);
        pushNotification("Berhasil", "Perubahan disimpan.", "SUCCESS");
      } catch (err: any) {
        console.warn("Update sync failed, falling back to merge setDoc", err);
        
        // Re-calculate flattened update explicitly for fallback
        const fallbackUpdate: any = { ...updated, updatedAt: serverTimestamp() };
        delete fallbackUpdate.scores;
        delete fallbackUpdate.scoreLogs;
        
        if (updated.settings) {
          delete fallbackUpdate.settings;
          Object.entries(updated.settings).forEach(([key, val]) => {
            fallbackUpdate[`settings.${key}`] = val;
          });
        }

        try {
          await setDoc(doc(db, 'events', id), fallbackUpdate, { merge: true });
          pushNotification("Berhasil (Sync)", "Perubahan disimpan.", "SUCCESS");
        } catch (setErr: any) {
          console.error("Critical Firestore Error:", setErr);
          pushNotification("Gagal Sync", setErr.message || "Network error", "WARNING");
          setHasPendingChanges(true);
        }
      }
    } else {
      setHasPendingChanges(true);
    }
  };

  const onRemoveParticipant = async (participantId: string) => {
    if (!appState.activeEventId) return;
    if (!confirm('Hapus peserta ini? Seluruh data skor dan registrasi terkait akan ikut terhapus.')) return;

    try {
      const activeEvent = appState.events.find(e => e.id === appState.activeEventId);
      if (!activeEvent) {
        throw new Error("Turnamen tidak ditemukan.");
      }

      // 1. Direct client-side deletion of submission document (Using user's fully authorized session)
      if (db) {
        const { doc, deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'events', appState.activeEventId, 'submissions', participantId));
        console.log(`[CLIENT-DELETE] Participant submission ${participantId} deleted via direct SDK`);
      }

      // 2. Direct client-side update of main event arrays & counter
      const currentArchers = activeEvent.archers || [];
      const currentOfficials = activeEvent.officials || [];
      const filteredArchers = currentArchers.filter((a: any) => a.id !== participantId);
      const filteredOfficials = currentOfficials.filter((o: any) => o.id !== participantId);

      const updatePayload: any = {
        archers: filteredArchers,
        officials: filteredOfficials,
        registrationCount: Math.max(0, (activeEvent.registrationCount || 0) - 1)
      };

      const activeEventAny = activeEvent as any;
      if (activeEventAny.data && typeof activeEventAny.data === 'object') {
        updatePayload["data.registrationCount"] = Math.max(0, (activeEventAny.data.registrationCount || 0) - 1);
        updatePayload["data.archers"] = filteredArchers;
        updatePayload["data.officials"] = filteredOfficials;
      }

      await handleUpdateEvent(activeEvent.id, updatePayload);
      pushNotification("Dihapus", "Peserta berhasil dihapus.", "SUCCESS");
    } catch (err: any) {
      console.error("Remove participant via Client SDK failed, trying backend-api fallback...", err);
      // Fallback in case client SDK isn't ready
      try {
        const res = await fetch('/api/delete-participant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: appState.activeEventId,
            participantId,
            authEmail: appState.currentUser?.email,
            authUid: appState.currentUser?.id
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Gagal menghapus peserta.");
        }

        pushNotification("Dihapus", "Peserta berhasil dihapus.", "SUCCESS");
      } catch (fallbackErr: any) {
        console.error("Remove participant fallback failed:", fallbackErr);
        pushNotification("Gagal", fallbackErr.message, "WARNING");
      }
    }
  };

  const onAddParticipant = async (participant: ParticipantRegistration) => {
    if (!appState.activeEventId) return;
    const activeEvent = appState.events.find(e => e.id === appState.activeEventId);
    if (!activeEvent) return;

    try {
      if (db && isOnline) {
        const { doc, setDoc } = await import('firebase/firestore');
        const subRef = doc(db, 'events', activeEvent.id, 'submissions', participant.id);
        await setDoc(subRef, {
          ...participant,
          serverTimestamp: serverTimestamp(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`[CLIENT-ADD] Participant submission ${participant.id} added in Firestore`);
      }

      const isOfficial = participant.regType === 'OFFICIAL' || participant.category === 'OFFICIAL';
      const currentArchers = activeEvent.archers || [];
      const currentOfficials = activeEvent.officials || [];

      let updatedArchers = [...currentArchers];
      let updatedOfficials = [...currentOfficials];

      if (isOfficial) {
        updatedOfficials.push(participant);
      } else {
        updatedArchers.push(participant as Archer);
      }

      const updatePayload: any = {
        archers: updatedArchers,
        officials: updatedOfficials,
        registrationCount: (activeEvent.registrationCount || 0) + 1
      };

      const activeEventAny = activeEvent as any;
      if (activeEventAny.data && typeof activeEventAny.data === 'object') {
        updatePayload["data.archers"] = updatedArchers;
        updatePayload["data.officials"] = updatedOfficials;
        updatePayload["data.registrationCount"] = (activeEventAny.data.registrationCount || 0) + 1;
      }

      await handleUpdateEvent(activeEvent.id, updatePayload);
      pushNotification("Berhasil", "Peserta berhasil ditambahkan secara manual.", "SUCCESS");
    } catch (err: any) {
      console.error("Manual add participant failed:", err);
      pushNotification("Gagal", err.message, "WARNING");
    }
  };

  const onUpdateParticipant = async (participantId: string, updates: Partial<ParticipantRegistration>) => {
    if (!appState.activeEventId) return;
    const activeEvent = appState.events.find(e => e.id === appState.activeEventId);
    if (!activeEvent) return;

    try {
      // Determine if it's an archer or official
      const archers = activeEvent.archers || [];
      const officials = activeEvent.officials || [];
      
      const isArcher = archers.some(a => a.id === participantId);
      const isOfficial = officials.some(o => o.id === participantId);

      if (!isArcher && !isOfficial) {
        throw new Error("Peserta tidak ditemukan.");
      }

      // Direct client-side update of subcollection submission document so onSnapshot is kept in sync
      if (db && isOnline) {
        const { doc, updateDoc } = await import('firebase/firestore');
        const subRef = doc(db, 'events', activeEvent.id, 'submissions', participantId);
        await updateDoc(subRef, {
          ...updates,
          updatedAt: new Date().toISOString()
        });
        console.log(`[CLIENT-UPDATE] Participant submission ${participantId} updated in Firestore`);
      }

      const payload: any = {};
      if (isArcher) {
        payload.archers = archers.map(a => a.id === participantId ? { ...a, ...updates } : a);
      } else {
        payload.officials = officials.map(o => o.id === participantId ? { ...o, ...updates } : o);
      }

      await handleUpdateEvent(activeEvent.id, payload);
    } catch (err: any) {
      console.error("Update participant error:", err);
      pushNotification("Gagal", err.message, "WARNING");
    }
  };

  const onBulkUpdateArchers = async (updatedArchers: Archer[]) => {
    if (!appState.activeEventId) return;
    const activeEvent = appState.events.find(e => e.id === appState.activeEventId);
    if (!activeEvent) return;

    try {
      if (db && isOnline) {
        const { writeBatch, doc } = await import('firebase/firestore');
        const batch = writeBatch(db);
        
        updatedArchers.forEach((archer) => {
          const subRef = doc(db, 'events', activeEvent.id, 'submissions', archer.id);
          batch.update(subRef, {
            targetNo: archer.targetNo,
            position: archer.position,
            wave: archer.wave,
            updatedAt: new Date().toISOString()
          });
        });
        
        await batch.commit();
        console.log(`[CLIENT-BULK-UPDATE] Shuffled positions written in batch for ${updatedArchers.length} archers`);
      }

      const payload = {
        archers: updatedArchers
      };
      
      await handleUpdateEvent(activeEvent.id, payload);
      pushNotification("Sukses", "Bantalan berhasil diperbarui.", "SUCCESS");
    } catch (err: any) {
      console.error("Bulk update archers error:", err);
      pushNotification("Gagal", err.message, "WARNING");
    }
  };

  const onDeleteEvent = async (id: string) => {
    // Note: Confirmation is already handled by MemberDashboard or AdminPanel modals
    try {
      // 1. Update local state immediately to provide feedback
      setAppState(prev => ({
        ...prev,
        events: prev.events.filter(e => e.id !== id)
      }));

      // 2. Perform robust Direct Client-Side Deletion (Uses user's fully authorized session)
      if (db) {
        const { doc, deleteDoc, collection, getDocs } = await import('firebase/firestore');
        const eventRef = doc(db, 'events', id);

        // a. Delete submissions subcollection
        console.log(`[CLIENT-DELETE] Fetching submissions for ${id}...`);
        const submissionsSnap = await getDocs(collection(db, 'events', id, 'submissions'));
        for (const sDoc of submissionsSnap.docs) {
          await deleteDoc(sDoc.ref);
        }
        console.log(`[CLIENT-DELETE] Deleted ${submissionsSnap.size} submissions`);

        // b. Delete shards subcollection
        const shardsSnap = await getDocs(collection(db, 'events', id, 'shards'));
        for (const sDoc of shardsSnap.docs) {
          await deleteDoc(sDoc.ref);
        }

        // c. Delete the main event doc
        await deleteDoc(eventRef);
        console.log(`[CLIENT-DELETE] Completed direct deletion of event: ${id}`);
        pushNotification("Dihapus", "Turnamen berhasil dihapus total.", "SUCCESS");
      } else {
        throw new Error("Koneksi database klien tidak aktif.");
      }
    } catch (err: any) {
      console.error("Direct SDK deletion failed, falling back to server API...", err);
      // Fallback in case client SDK fails
      try {
        const res = await fetch(`/api/delete-event/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            authEmail: appState.currentUser?.email,
            authUid: appState.currentUser?.id 
          })
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Gagal menghapus dari server.");
        }

        pushNotification("Dihapus", "Turnamen berhasil dihapus total.", "SUCCESS");
      } catch (fallbackErr: any) {
        console.error("Delete event fallback failed:", fallbackErr);
        fetchCloudData();
        pushNotification("Gagal Menghapus", fallbackErr.message, "WARNING");
      }
    }
  };

  const onResetSystemData = async () => {
    const isAdmin = appState.currentUser?.role === UserRole.SUPERADMIN || 
      ['poedji.sugianto@gmail.com', 'admin@arcus.id'].includes(appState.currentUser?.email || '');
    if (!isAdmin) return;
    if (!confirm("Hapus seluruh data sistem?")) return;

    setIsSyncing(true);
    try {
      const res = await fetch("/api/admin/nuke-database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authEmail: appState.currentUser.email })
      });
      if (res.ok) {
        pushNotification("Reset Berhasil", "Database dibersihkan.", "SUCCESS");
        window.location.reload();
      } else {
        throw new Error("Gagal nuke database");
      }
    } catch (err: any) {
      pushNotification("Gagal", err.message, "WARNING");
    } finally {
      setIsSyncing(false);
    }
  };

  const activeEvent = useMemo(() => 
    appState.events.find(e => e.id === appState.activeEventId) || null
  , [appState.events, appState.activeEventId]);

  const activeEventArchers = useMemo(() => {
    if (!activeEvent) return [];
    const fromArchers = (activeEvent.archers || []).filter(a => a.category !== CategoryType.OFFICIAL);
    const fromRegs = (activeEvent.registrations || [])
      .filter((r: any) => r.regType !== 'OFFICIAL' && r.category !== CategoryType.OFFICIAL)
      .map((r: any) => ({
        ...r,
        category: r.category as CategoryType,
        targetNo: r.targetNo || 0,
        wave: r.wave || 1
      } as Archer));
    const combined = [...fromArchers, ...fromRegs];
    return Array.from(new Map(combined.map(item => [item.id, item])).values());
  }, [activeEvent]);

  const activeEventOfficials = useMemo(() => {
    if (!activeEvent) return [];
    const fromArchers = (activeEvent.archers || []).filter(a => a.category === CategoryType.OFFICIAL);
    const fromOfficials = activeEvent.officials || [];
    const fromRegs = (activeEvent.registrations || [])
      .filter((r: any) => r.regType === 'OFFICIAL' || r.category === CategoryType.OFFICIAL);
    const combined = [...fromArchers, ...fromOfficials, ...fromRegs];
    return Array.from(new Map(combined.map(item => [item.id, item])).values());
  }, [activeEvent]);

  // Main UI Router
  const renderView = () => {
    if (quotaExceeded && !isOnline) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
          <h1 className="text-2xl font-black mb-4">MODE OFFLINE DARURAT</h1>
          <p className="text-slate-600 mb-8 max-w-md">Limit Firestore Arcus telah habis hari ini. Sistem beralih ke mode offline sepenuhnya. Data hanya disimpan di perangkat ini.</p>
          <button onClick={() => setQuotaExceeded(false)} className="px-8 py-3 bg-arcus-red text-white rounded-2xl font-bold uppercase tracking-widest">Lanjutkan Offline</button>
        </div>
      );
    }

    switch(view) {
      case 'LANDING':
        return <LandingPage 
          events={appState.events} 
          currentUser={appState.currentUser}
          onViewLive={(id) => {
            setAppState(prev => ({ ...prev, activeEventId: id }));
            setView('LIVE_SCOREBOARD');
          }}
          onViewParticipants={(id) => {
            setAppState(prev => ({ ...prev, activeEventId: id }));
            setView('PUBLIC_EVENT_INFO');
          }}
          onViewInfo={(id) => {
            setAppState(prev => ({ ...prev, activeEventId: id }));
            setView('PUBLIC_EVENT_INFO');
          }}
          onRegister={(id) => {
            setAppState(prev => ({ ...prev, activeEventId: id }));
            setView('REGISTER_PARTICIPANT');
          }}
          onLogin={() => setView('LOGIN_PANEL')}
          onScorerLogin={() => setView('SCORER_LOGIN')}
          onCreateEvent={() => {
            if (!appState.currentUser) {
              setView('LOGIN_PANEL');
            } else {
              setView('MEMBER_DASHBOARD');
            }
          }}
          onShare={(id) => {
            const ev = appState.events.find(e => e.id === id);
            setShareData({
              isOpen: true,
              url: window.location.origin + '?event=' + id,
              name: ev?.settings.tournamentName || 'Turnamen Panahan'
            });
          }}
          onLogout={handleLogout}
          onRefresh={() => syncCloudData(true)}
          isSyncing={isSyncing}
          quotaExceeded={quotaExceeded}
        />;
      
      case 'REGISTER_PARTICIPANT':
        if (!activeEvent) return null;
        return <RegistrationPanel 
          event={activeEvent}
          globalSettings={appState.globalSettings}
          onRegister={async (regs) => {
            console.log("App: onRegister called with", regs.length, "registrations");
            
            const newArchers = regs.filter(r => r.regType !== 'OFFICIAL');
            const newOfficials = regs.filter(r => r.regType === 'OFFICIAL');

            // 1. Instantly update React local state so UI updates without lag
            setAppState(prev => {
              const updatedEvents = prev.events.map(e => {
                if (e.id === activeEvent.id) {
                  const existingArchers = e.archers || [];
                  const existingOfficials = e.officials || [];
                  const existingRegs = e.registrations || [];

                  const archerMap = new Map(existingArchers.map(a => [a.id, a]));
                  newArchers.forEach(a => archerMap.set(a.id, a as Archer));

                  const officialMap = new Map(existingOfficials.map(o => [o.id, o]));
                  newOfficials.forEach(o => officialMap.set(o.id, o as any));

                  const regMap = new Map(existingRegs.map(r => [r.id, r]));
                  regs.forEach(r => regMap.set(r.id, r));

                  return {
                    ...e,
                    archers: Array.from(archerMap.values()),
                    officials: Array.from(officialMap.values()),
                    registrations: Array.from(regMap.values()),
                    registrationCount: regMap.size
                  };
                }
                return e;
              });
              return { ...prev, events: updatedEvents };
            });

            // 2. Persist to server API
            try {
              const res = await fetch("/api/register-participant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  eventId: activeEvent.id,
                  registrations: regs,
                  archers: newArchers,
                  officials: newOfficials
                })
              });
              
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || "Gagal registrasi ke server.");
              }
              
              pushNotification("Berhasil", "Pendaftaran terkirim.", "SUCCESS");
              // We do NOT call setView('LANDING') here to allow OnlineRegistration to show its success screen (Step 3)
            } catch (err: any) {
              console.warn("App: service API registration failed, attempting client-side Direct SDK write fallback...", err);
              if (db) {
                try {
                  const batch = writeBatch(db);
                  regs.forEach((reg: any) => {
                    const subRef = doc(db, 'events', activeEvent.id, 'submissions', reg.id);
                    batch.set(subRef, {
                      ...reg,
                      serverTimestamp: serverTimestamp(),
                      updatedAt: new Date().toISOString()
                    }, { merge: true });
                  });
                  await batch.commit();
                  console.log("App: Client-side Direct SDK write success fallback");
                  pushNotification("Berhasil (Direct Sync)", "Pendaftaran disimpan langsung ke database.", "SUCCESS");
                } catch (fallbackErr: any) {
                  console.error("App: Client-side Direct SDK fallback failed too", fallbackErr);
                  pushNotification("Gagal", `Pendaftaran Gagal: ${err.message}. Error database: ${fallbackErr.message}`, "WARNING");
                  throw fallbackErr;
                }
              } else {
                pushNotification("Gagal", err.message, "WARNING");
                throw err;
              }
            }
          }}
          onBack={() => setView('LANDING')}
          onViewParticipants={() => setView('ENTRY_LIST')}
        />;

      case 'SCORER_LOGIN':
        return <ScorerLogin 
          events={appState.events}
          onLogin={(event, scorer) => {
            setAppState(prev => ({ ...prev, activeEventId: event.id, activeScorer: scorer }));
            setView('SCORER_PANEL');
            pushNotification("Akses Diterima", `Pencatat Skor: ${scorer.name}`, "SUCCESS");
          }}
          onBack={() => setView('LANDING')}
        />;

      case 'SCORER_PANEL':
        if (!activeEvent) return null;
        return <ScoringPanel 
          state={{ ...activeEvent, archers: activeEventArchers, officials: activeEventOfficials }}
          currentScorer={appState.activeScorer}
          onSaveScore={async (score) => {
            const scores = Array.isArray(score) ? score : [score];
            handleUpdateEvent(activeEvent.id, {
               scores: [...(activeEvent.scores || []), ...scores]
            });
          }}
          onBack={() => {
            if (appState.currentUser) {
              setView('EVENT_ADMIN');
            } else {
              setView('LANDING');
            }
          }}
        />;

      case 'LOGIN_PANEL':
        return <LoginPanel 
          onLogin={onLoginSuccess}
          onRegister={(u) => {}}
          onUpdateUser={(u) => {}}
          users={appState.users}
          onBack={() => setView('LANDING')}
        />;

      case 'MEMBER_DASHBOARD':
        return <MemberDashboard 
          userName={appState.currentUser?.name}
          userId={appState.currentUser?.id || ''}
          userRole={appState.currentUser?.role}
          currentUser={appState.currentUser}
          isSuperAdmin={
            appState.currentUser?.role === UserRole.SUPERADMIN || 
            ['poedji.sugianto@gmail.com', 'admin@arcus.id'].includes(appState.currentUser?.email || '')
          }
          onGoToSuperAdmin={() => setView('SUPER_ADMIN')}
          notifications={notifications}
          onMarkNotifRead={() => setNotifications([])}
          globalSettings={appState.globalSettings}
          events={appState.events.filter(e => {
             if (!e) return false;
             const isOwner = e.settings?.organizerId === appState.currentUser?.id || e.ownerId === appState.currentUser?.id || e.ownerId === appState.currentUser?.email;
             const isScorer = (e as any).scorerAccess?.some((s: any) => s && s.email === appState.currentUser?.email);
             return !!(isOwner || isScorer);
          })}
          onCreateEvent={async (name) => {
             const id = 'evt_' + Date.now();
             const newEvent: ArcheryEvent = {
               id,
               ownerId: appState.currentUser?.id || appState.currentUser?.email || '',
               status: 'DRAFT',
               settings: {
                 tournamentName: name || 'Turnamen Baru',
                 organizerId: appState.currentUser?.id || appState.currentUser?.email || '',
                 eventDate: new Date().toISOString(),
                 location: '',
                 isFreeEvent: false,
                 archersPerTarget: 2,
                 totalTargets: 1,
                 totalArrows: 36,
                 arrowsPerEnd: 6,
                 totalEnds: 6,
                 isActivated: false
               },
               archers: [],
               officials: [],
               registrations: [],
               scores: [],
               scoreLogs: [],
               matches: {} as any
             };
             
             // Immediate state update
             setAppState(prev => ({ ...prev, events: [newEvent, ...prev.events], activeEventId: id }));
             setView('EVENT_ADMIN');
             
             // Aggressive sync to cloud
             if (isOnline && db) {
               try {
                 await setDoc(doc(db, 'events', id), newEvent);
                 pushNotification('Draft Event Dibuat', 'Tersimpan di cloud.', 'SUCCESS');
               } catch (err: any) {
                 console.error("Create event sync error:", err);
                 setHasPendingChanges(true);
               }
             } else {
               setHasPendingChanges(true);
             }
          }}
          onCreatePractice={() => {}}
          onCreateSelfPractice={() => {}}
          onManageEvent={(id) => {
            setAppState(prev => ({ ...prev, activeEventId: id }));
            setView('EVENT_ADMIN');
          }}
          onViewLive={(id) => {
            setAppState(prev => ({ ...prev, activeEventId: id }));
            setView('LIVE_SCOREBOARD');
          }}
          onUpdateEvent={handleUpdateEvent}
          onDeleteEvent={onDeleteEvent}
          onActivateEvent={handleActivateEvent}
          onShare={(id, name) => {
            setShareData({
              isOpen: true,
              url: window.location.origin + '?event=' + id,
              name: name || 'Turnamen Panahan'
            });
          }}
          onLogout={handleLogout}
          isSyncing={isSyncing}
        />;

      case 'ACTIVATE_TOURNAMENT':
        if (!activatingEventId) {
          setView('MEMBER_DASHBOARD');
          return null;
        }
        const activeEventToActivate = appState.events.find(e => e.id === activatingEventId);
        if (!activeEventToActivate) {
          setView('MEMBER_DASHBOARD');
          return null;
        }
        return <ActivateTournament 
          event={activeEventToActivate}
          userEmail={appState.currentUser?.email || ''}
          onActivate={(code) => {
            const trimmedCode = code.trim();
            const expectedCode = (activationCode || '').trim();
            
            if (!activatingEventId) {
              pushNotification('Error', 'Sesi aktivasi kadaluarsa.', 'WARNING');
              setView('MEMBER_DASHBOARD');
              return;
            }

            if (trimmedCode === expectedCode) {
              const eventToUpdate = appStateRef.current.events.find(e => e.id === activatingEventId);
              if (eventToUpdate) {
                // Ensure we explicitly pass status to UPCOMING and settings.isActivated to true
                handleUpdateEvent(activatingEventId, { 
                  status: 'UPCOMING',
                  settings: { 
                    ...eventToUpdate.settings, 
                    isActivated: true 
                  } 
                }).then(() => {
                  pushNotification('Aktivasi Berhasil', 'Turnamen Anda telah aktif.', 'SUCCESS');
                  setView('MEMBER_DASHBOARD');
                  setActivatingEventId(null);
                  setActivationCode(null);
                });
              } else {
                pushNotification('Error', 'Event tidak ditemukan.', 'WARNING');
                setView('MEMBER_DASHBOARD');
              }
            } else {
              pushNotification('Kode Salah', 'Kode aktivasi tidak valid.', 'WARNING');
            }
          }}
          onBack={() => setView('MEMBER_DASHBOARD')}
          onResend={(phone) => handleActivateEvent(activatingEventId, phone)}
        />;

      case 'EVENT_ADMIN':
        if (!activeEvent) return null;
        return <AdminPanel 
          eventId={activeEvent.id}
          settings={activeEvent.settings}
          scorerAccess={activeEvent.scorerAccess || []}
          archers={activeEventArchers}
          officials={activeEventOfficials}
          onSave={async (updatedSettings) => {
            handleUpdateEvent(activeEvent.id, { settings: updatedSettings });
          }}
          onUpdateScorers={async (scorers) => {
            handleUpdateEvent(activeEvent.id, { scorerAccess: scorers });
          }}
          onClear={() => {}}
          onDelete={() => onDeleteEvent(activeEvent.id)}
          onRemoveParticipant={onRemoveParticipant}
          onAddParticipant={onAddParticipant}
          onUpdateParticipant={onUpdateParticipant}
          onBulkUpdateArchers={onBulkUpdateArchers}
          onBack={() => setView('MEMBER_DASHBOARD')}
          onManageElimination={() => setView('ELIMINATION_PANEL')}
          onManageFinance={() => setView('FINANCE_PANEL')}
          onManageIdCards={() => setView('ID_CARD_EDITOR')}
          onGoToOperatorCenter={() => setView('OPERATOR_CENTER')}
          onGoToQuickScoring={() => setView('QUICK_SCORING_PANEL')}
          onGoToFieldScoring={() => setView('SCORER_PANEL')}
          globalSettings={appState.globalSettings}
          isSuperAdmin={
            appState.currentUser?.role === UserRole.SUPERADMIN || 
            appState.currentUser?.role === UserRole.ADMIN || 
            appState.currentUser?.role === UserRole.MASTER_ADMIN ||
            ['poedji.sugianto@gmail.com', 'poedjisugianto@gmail.com', 'admin@arcus.id', 'arcus.id@gmail.com'].includes(appState.currentUser?.email || '')
          }
        />;

      case 'ID_CARD_EDITOR':
        if (!activeEvent) return null;
        return <IdCardEditor 
          archers={activeEventArchers}
          settings={activeEvent.settings}
          onBack={() => setView('EVENT_ADMIN')}
        />;

      case 'OPERATOR_CENTER':
        if (!activeEvent) return null;
        return <OperatorCenter 
          event={{ ...activeEvent, archers: activeEventArchers, officials: activeEventOfficials }}
          onSaveScore={async (score, log) => {
            const scores = Array.isArray(score) ? score : [score];
            const logs = log ? (Array.isArray(log) ? log : [log]) : [];
            handleUpdateEvent(activeEvent.id, {
              scores: [...(activeEvent.scores || []), ...scores],
              scoreLogs: [...(activeEvent.scoreLogs || []), ...logs]
            });
            pushNotification("Skor Disimpan", "Koreksi operator berhasil terekam.", "SUCCESS");
          }}
          onBack={() => setView('EVENT_ADMIN')}
        />;

      case 'QUICK_SCORING_PANEL':
        if (!activeEvent) return null;
        return <QuickScoringPanel 
          event={{ ...activeEvent, archers: activeEventArchers, officials: activeEventOfficials }}
          currentScorer={appState.activeScorer}
          onSaveScore={async (score) => {
            const scores = Array.isArray(score) ? score : [score];
            handleUpdateEvent(activeEvent.id, {
              scores: [...(activeEvent.scores || []), ...scores]
            });
            pushNotification("Skor Disimpan", "Rekapitulasi cepat berhasil disimpan.", "SUCCESS");
          }}
          onBack={() => setView('EVENT_ADMIN')}
        />;

      case 'ADMIN_DASHBOARD':
        return <AdminDashboard 
          user={appState.currentUser!}
          events={appState.events.filter(e => {
             if (!e) return false;
             const isOwner = e.ownerId === appState.currentUser?.id || e.ownerId === appState.currentUser?.email;
             const isSuperAdmin = appState.currentUser?.role === UserRole.SUPERADMIN;
             return isOwner || isSuperAdmin;
          })}
          onManageEvent={(id) => {
            setAppState(prev => ({ ...prev, activeEventId: id }));
            setView('EVENT_ADMIN');
          }}
          onCreateEvent={() => {
            setView('MEMBER_DASHBOARD');
            pushNotification("Info", "Pilih 'Buat Event Baru' di dashboard member.", "INFO");
          }}
        />;

      case 'SUPER_ADMIN':
        return <SuperAdminPanel 
          state={appState}
          onUpdateSettings={async (gs) => {
            setAppState(prev => ({ ...prev, globalSettings: gs }));
            if (appStateRef.current) {
              appStateRef.current.globalSettings = gs;
            }
            
            // Save to localStorage immediately
            try {
              const stateToSave = {
                globalSettings: gs,
                events: appState.events
              };
              localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
            } catch (storageErr) {
              console.warn("Error saving to localStorage", storageErr);
            }

            // Save to Firestore client SDK if connected
            if (db) {
              try {
                await setDoc(doc(db, 'systemConfigs', 'global'), { 
                  id: 'global', 
                  data: gs, 
                  updatedAt: serverTimestamp() 
                }, { merge: true });
              } catch (fsErr: any) {
                console.warn("[FIRESTORE] Direct write error:", fsErr.message);
              }
            }

            // Also call server API endpoint to update backend cache & Firestore server-side
            try {
              await fetch('/api/admin/save-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  settings: gs, 
                  authEmail: appState.currentUser?.email 
                })
              });
            } catch (apiErr) {
              console.warn("[API] Save settings endpoint error:", apiErr);
            }

            setHasPendingChanges(false);
            pushNotification("Pengaturan Tersimpan", "Konfigurasi master berhasil disimpan.", "SUCCESS");
          }}
          onResetSystemData={() => onResetSystemData()}
          onUpdateEvent={handleUpdateEvent}
          onDeleteEvent={onDeleteEvent}
          onDeleteUser={(uid) => {}}
          onUpdateUser={(u) => {}}
          onSendNotif={(n) => pushNotification(n.title, n.message, n.type as any)}
          onBack={() => setView('MEMBER_DASHBOARD')}
        />;

      case 'PUBLIC_EVENT_INFO':
        if (!activeEvent) return null;
        return <EventInfo 
          event={{ ...activeEvent, archers: activeEventArchers, officials: activeEventOfficials }}
          onRegister={() => setView('REGISTER_PARTICIPANT')}
          onBack={() => setView('LANDING')}
          onShare={() => {
             setShareData({
              isOpen: true,
              url: window.location.origin + '?event=' + activeEvent.id,
              name: activeEvent.settings.tournamentName || 'Turnamen Panahan'
            });
          }}
          onViewParticipants={() => setView('ENTRY_LIST')}
          onViewLiveScoreboard={() => setView('LIVE_SCOREBOARD')}
        />;

      case 'LIVE_SCOREBOARD':
        if (!activeEvent) return null;
        return <LiveScoreboard 
          state={{ ...activeEvent, archers: activeEventArchers, officials: activeEventOfficials }}
          onBack={() => {
            if (appState.currentUser) {
              setView('EVENT_ADMIN');
            } else {
              setView('PUBLIC_EVENT_INFO');
            }
          }}
        />;

      case 'ENTRY_LIST':
        if (!activeEvent) return null;
        return <EntryList 
          event={{ ...activeEvent, archers: activeEventArchers, officials: activeEventOfficials }}
          onBack={() => setView('PUBLIC_EVENT_INFO')}
          onRefresh={() => refreshActiveEventDetails(true)}
          isSyncing={isSyncing}
        />;

      default:
        return <LandingPage 
          events={appState.events} 
          currentUser={appState.currentUser}
          onViewLive={(id) => {
            setAppState(prev => ({ ...prev, activeEventId: id }));
            setView('LIVE_SCOREBOARD');
          }}
          onViewParticipants={(id) => {
            setAppState(prev => ({ ...prev, activeEventId: id }));
            setView('PUBLIC_EVENT_INFO');
          }}
          onViewInfo={(id) => {
            setAppState(prev => ({ ...prev, activeEventId: id }));
            setView('PUBLIC_EVENT_INFO');
          }}
          onRegister={(id) => {
            setAppState(prev => ({ ...prev, activeEventId: id }));
            setView('REGISTER_PARTICIPANT');
          }}
          onLogin={() => setView('LOGIN_PANEL')}
          onScorerLogin={() => setView('SCORER_LOGIN')}
          onCreateEvent={() => {
            if (!appState.currentUser) {
              setView('LOGIN_PANEL');
            } else {
              setView('MEMBER_DASHBOARD');
            }
          }}
          onShare={(id) => {
            const ev = appState.events.find(e => e.id === id);
            setShareData({
              isOpen: true,
              url: window.location.origin + '?event=' + id,
              name: ev?.settings.tournamentName || 'Turnamen Panahan'
            });
          }}
          onLogout={handleLogout}
          onRefresh={() => syncCloudData(true)}
          isSyncing={isSyncing}
          quotaExceeded={quotaExceeded}
        />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden font-sans selection:bg-arcus-red/10 selection:text-arcus-red">
      {isSplashVisible && (
        <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center animate-out fade-out duration-700 delay-1000 fill-mode-forwards">
          <ArcusLogo className="w-48 h-48 animate-pulse text-arcus-red" />
        </div>
      )}

      {/* Network Status Bar */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest py-1 flex items-center justify-center gap-2 print:hidden">
          <CloudOff className="w-3 h-3" /> BEKERJA OFFLINE (SINKRONISASI AKTIF)
        </div>
      )}

      <main className="relative z-10">{renderView()}</main>

      {/* Persistent Status Indicators */}
      <div className="fixed bottom-6 left-6 z-50 flex items-center gap-3 print:hidden">
        {isSyncing && (
          <div className="bg-white/80 backdrop-blur-md border px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in slide-in-from-left">
            <RefreshCw className="w-3 h-3 animate-spin text-arcus-red" />
            <span className="text-[10px] font-bold uppercase text-slate-500">Syncing...</span>
          </div>
        )}
        {hasPendingChanges && !isSyncing && (
          <div className="bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <Cloud className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase">Pending</span>
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="fixed top-6 right-6 z-[1000] flex flex-col gap-3 max-w-sm w-full print:hidden">
          {notifications.map(n => (
            <div key={n.id} className={`p-4 rounded-2xl shadow-xl border-l-4 animate-in slide-in-from-right flex gap-3 ${
              n.type === 'SUCCESS' ? 'bg-white border-green-500' : 
              n.type === 'WARNING' ? 'bg-white border-orange-500' : 
              n.type === 'ERROR' ? 'bg-white border-red-500' : 'bg-white border-blue-500'
            }`}>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{n.title}</p>
                <p className="text-sm font-medium text-slate-600">{n.message}</p>
              </div>
              <button onClick={() => setNotifications(prev => prev.filter(nn => nn.id !== n.id))} className="text-slate-300 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
