import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Edit2, Trash2, Home, Settings, MapPin, CheckCircle, XCircle,
  Building, Filter, ChevronRight, Activity, PieChart, DollarSign, Lock,
  LogOut, Upload, X, ChevronLeft, Image as ImageIcon, Map as MapIcon, Menu,
  Bell, Phone, User as UserIcon, Calendar
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, getDoc, 
  onSnapshot, addDoc, updateDoc, deleteDoc, query 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';

// --- CONFIGURATION FIREBASE ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'abidjan-immo-cloud';

const ROOM_TYPES = ["Studio", "1 pièce", "2 pièces", "3 pièces", "4 pièces +"];

const App = () => {
  // --- ÉTATS ---
  const [user, setUser] = useState(null);
  const [residences, setResidences] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ÉTATS NAVIGATION & UI ---
  const [isAdminView, setIsAdminView] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginData, setLoginData] = useState({ user: "", pass: "" });
  const [loginError, setLoginError] = useState("");
  const [newCommune, setNewCommune] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCommune, setFilterCommune] = useState("");
  const [filterType, setFilterType] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingTarget, setBookingTarget] = useState(null);
  const [bookingForm, setBookingForm] = useState({ name: "", phone: "" });
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [editingResidence, setEditingResidence] = useState(null);
  const [selectedResidence, setSelectedResidence] = useState(null);
  const [currentGalleryIndex, setCurrentGalleryIndex] = useState(0);

  const [formData, setFormData] = useState({
    nom: "",
    ville: "Abidjan",
    commune: "",
    type: "Studio",
    prix: "",
    etat: "disponible",
    images: []
  });

  // --- AUTHENTIFICATION INITIALE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Erreur d'authentification:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // --- SYNCHRONISATION FIRESTORE ---
  useEffect(() => {
    if (!user) return;

    // Résidences
    const qResidences = collection(db, 'artifacts', appId, 'public', 'data', 'residences');
    const unsubRes = onSnapshot(qResidences, (snapshot) => {
      setResidences(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });

    // Communes
    const qCommunes = collection(db, 'artifacts', appId, 'public', 'data', 'communes');
    const unsubCom = onSnapshot(qCommunes, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data().name).sort();
      setCommunes(docs.length > 0 ? docs : ["Cocody", "Marcory", "Plateau", "Yopougon", "Bingerville"]);
    });

    // Réservations (pour l'admin)
    const qBookings = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const unsubBook = onSnapshot(qBookings, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => b.createdAt - a.createdAt));
    });

    return () => { unsubRes(); unsubCom(); unsubBook(); };
  }, [user]);

  // --- LOGIQUE ADMIN ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.user === "TigRey" && loginData.pass === "ReyTiger2@@26") {
      setIsAuthenticated(true);
      setLoginError("");
    } else {
      setLoginError("Identifiants incorrects.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsAdminView(false);
    setLoginData({ user: "", pass: "" });
  };

  // --- ACTIONS CRUD ---
  const handleAddCommune = async (e) => {
    e.preventDefault();
    if (!user || !newCommune.trim()) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'communes'), { name: newCommune.trim() });
      setNewCommune("");
    } catch (err) { console.error(err); }
  };

  const handleDeleteResidence = async (id) => {
    if (!user || !window.confirm("Supprimer ce bien ?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'residences', id));
    } catch (err) { console.error(err); }
  };

  const handleDeleteBooking = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id));
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      if (editingResidence) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'residences', editingResidence), formData);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'residences'), formData);
      }
      setIsFormOpen(false);
    } catch (err) { console.error(err); }
  };

  // --- LOGIQUE RÉSERVATION CLIENT ---
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!user || !bookingTarget) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), {
        clientName: bookingForm.name,
        clientPhone: bookingForm.phone,
        residenceId: bookingTarget.id,
        residenceNom: bookingTarget.nom,
        createdAt: Date.now(),
        status: 'nouveau'
      });
      setBookingSuccess(true);
      setTimeout(() => {
        setIsBookingModalOpen(false);
        setBookingSuccess(false);
        setBookingForm({ name: "", phone: "" });
      }, 2500);
    } catch (err) { console.error(err); }
  };

  const openBooking = (res) => {
    setBookingTarget(res);
    setIsBookingModalOpen(true);
  };

  // --- CALCULS ---
  const stats = useMemo(() => ({
    total: residences.length,
    dispo: residences.filter(r => r.etat === 'disponible').length,
    bookings: bookings.length,
    ca: residences.reduce((acc, curr) => acc + (Number(curr.prix) || 0), 0)
  }), [residences, bookings]);

  const filteredResidences = useMemo(() => {
    return residences.filter(res => {
      const matchSearch = res.nom.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCommune = filterCommune === "" || res.commune === filterCommune;
      const matchType = filterType === "" || res.type === filterType;
      return matchSearch && matchCommune && matchType;
    });
  }, [residences, searchTerm, filterCommune, filterType]);

  const handleOpenForm = (res = null) => {
    if (res) {
      setEditingResidence(res.id);
      setFormData(res);
    } else {
      setEditingResidence(null);
      setFormData({ nom: "", ville: "Abidjan", commune: communes[0] || "", type: "Studio", prix: "", etat: "disponible", images: [] });
    }
    setIsFormOpen(true);
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(p => ({ ...p, images: [...p.images, reader.result] }));
      reader.readAsDataURL(file);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Abidjan Immo Cloud...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 md:px-6 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setIsAdminView(false); setIsAuthenticated(false); }}>
          <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg">
            <Building size={20} />
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-indigo-900">Abidjan<span className="text-indigo-500">Immo</span></h1>
        </div>
        
        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-all"><LogOut size={18} /></button>
          )}
          <button 
            onClick={() => setIsAdminView(!isAdminView)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-xs transition-all shadow-sm ${
              isAdminView ? "bg-amber-100 text-amber-700" : "bg-indigo-50 text-indigo-700"
            }`}
          >
            {isAdminView ? <Home size={16} /> : <Settings size={16} />}
            <span className="hidden sm:inline">{isAdminView ? "Quitter Admin" : "Espace Admin"}</span>
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-10">
        {!isAdminView ? (
          /* VUE CLIENT */
          <>
            <section className="mb-12 text-center md:text-left">
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-4 leading-tight">
                Vivez <span className="text-indigo-600">Abidjan</span> <br className="hidden md:block"/>autrement.
              </h2>
              <p className="text-slate-500 text-sm md:text-lg max-w-2xl mb-10 mx-auto md:mx-0">
                Découvrez notre sélection exclusive et réservez votre séjour en quelques clics.
              </p>

              {/* Barre de recherche */}
              <div className="bg-white p-3 rounded-2xl md:rounded-3xl shadow-xl shadow-indigo-100/50 border border-slate-100 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="text" 
                    placeholder="Où voulez-vous dormir ?" 
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 md:flex gap-3">
                  <select className="flex-1 px-3 py-3 bg-slate-50 rounded-xl outline-none text-xs font-bold text-slate-600" value={filterCommune} onChange={(e) => setFilterCommune(e.target.value)}>
                    <option value="">Communes</option>
                    {communes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="flex-1 px-3 py-3 bg-slate-50 rounded-xl outline-none text-xs font-bold text-slate-600" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                    <option value="">Types</option>
                    {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </section>

            {/* Grille de cartes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredResidences.map(res => (
                <div key={res.id} className="group bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all border border-slate-100 flex flex-col">
                  <div className="relative h-60 overflow-hidden cursor-pointer" onClick={() => { setSelectedResidence(res); setCurrentGalleryIndex(0); }}>
                    <img src={res.images[0]} alt={res.nom} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[9px] font-black uppercase text-white shadow-lg ${
                      res.etat === 'disponible' ? 'bg-emerald-500' : 'bg-red-500'
                    }`}>
                      {res.etat}
                    </span>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-extrabold text-slate-800">{res.nom}</h3>
                      <p className="text-indigo-600 font-black">{res.prix.toLocaleString()} F</p>
                    </div>
                    <p className="flex items-center text-slate-400 text-xs mb-6 gap-1.5 font-bold">
                      <MapPin size={14} className="text-indigo-400" /> {res.commune}
                    </p>
                    <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between gap-2">
                      <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase whitespace-nowrap">
                        {res.type}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => { setSelectedResidence(res); setCurrentGalleryIndex(0); }} className="text-slate-400 p-2 hover:bg-slate-50 rounded-xl transition-colors">
                          <ChevronRight size={18} />
                        </button>
                        <button 
                          disabled={res.etat !== 'disponible'}
                          onClick={() => openBooking(res)}
                          className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
                            res.etat === 'disponible' ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          <Calendar size={14} /> Réserver
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : !isAuthenticated ? (
          /* LOGIN ADMIN */
          <div className="flex items-center justify-center py-20">
            <div className="bg-white p-8 md:p-12 rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-md text-center">
              <div className="bg-indigo-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8 text-indigo-600">
                <Lock size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-6">Authentification</h2>
              <form onSubmit={handleLogin} className="space-y-4 text-left">
                <input type="text" required className="w-full px-5 py-4 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="Identifiant" value={loginData.user} onChange={(e) => setLoginData({...loginData, user: e.target.value})}/>
                <input type="password" required className="w-full px-5 py-4 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="Mot de passe" value={loginData.pass} onChange={(e) => setLoginData({...loginData, pass: e.target.value})}/>
                {loginError && <p className="text-red-500 text-xs font-bold text-center">{loginError}</p>}
                <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95">Se connecter</button>
              </form>
            </div>
          </div>
        ) : (
          /* DASHBOARD ADMIN */
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900">Console Admin</h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Données Cloud synchronisées</p>
              </div>
              <button onClick={() => handleOpenForm()} className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg active:scale-95 text-sm">
                <Plus size={20} /> Nouveau bien
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {[
                { label: "Biens", val: stats.total, icon: Building, color: "indigo" },
                { label: "Dispos", val: stats.dispo, icon: CheckCircle, color: "emerald" },
                { label: "Réservations", val: stats.bookings, icon: Bell, color: "red" },
                { label: "Valeur Parc", val: `${(stats.ca / 1000000).toFixed(1)}M`, icon: DollarSign, color: "amber" }
              ].map((s, i) => (
                <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row items-center gap-4">
                  <div className={`p-3 rounded-xl bg-${s.color}-50 text-${s.color}-600`}>
                    <s.icon size={24} />
                  </div>
                  <div className="text-center md:text-left">
                    <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">{s.label}</p>
                    <p className="text-xl font-black text-slate-900">{s.val}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Réservations à traiter */}
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                  <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-red-50/30">
                    <h3 className="font-black text-red-600 uppercase text-xs tracking-widest flex items-center gap-2">
                      <Bell size={16} /> Demandes de Réservation ({bookings.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {bookings.length === 0 ? (
                      <div className="p-20 text-center text-slate-300">
                        <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-bold">Aucune réservation pour le moment</p>
                      </div>
                    ) : bookings.map(book => (
                      <div key={book.id} className="p-6 md:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="bg-indigo-50 p-3 rounded-full text-indigo-600">
                            <UserIcon size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800">{book.clientName}</p>
                            <p className="text-indigo-600 text-xs font-black flex items-center gap-1 mt-1">
                              <Phone size={12} /> {book.clientPhone}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                              Bien : {book.residenceNom} • {new Date(book.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={`tel:${book.clientPhone}`} className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-sm">
                            <Phone size={14} /> Appeler
                          </a>
                          <button onClick={() => handleDeleteBooking(book.id)} className="p-3 text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Liste des Biens */}
                <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                   <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
                      <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Gestion du Parc</h3>
                   </div>
                   <div className="divide-y divide-slate-50">
                     {residences.map(res => (
                       <div key={res.id} className="p-4 md:px-8 md:py-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                         <div className="flex items-center gap-4">
                           <img src={res.images[0]} className="w-12 h-12 rounded-xl object-cover shadow-sm" />
                           <div>
                             <p className="text-sm font-black text-slate-800">{res.nom}</p>
                             <p className="text-[10px] font-bold text-slate-400 uppercase">{res.commune} • {res.prix.toLocaleString()} F</p>
                           </div>
                         </div>
                         <div className="flex items-center gap-2 md:gap-4">
                           <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border ${
                             res.etat === 'disponible' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
                           }`}>
                             {res.etat}
                           </span>
                           <button onClick={() => handleOpenForm(res)} className="p-2 text-slate-300 hover:text-indigo-600"><Edit2 size={16}/></button>
                           <button onClick={() => handleDeleteResidence(res.id)} className="p-2 text-slate-300 hover:text-red-600"><Trash2 size={16}/></button>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
              </div>

              {/* Zones */}
              <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm h-fit">
                <h3 className="text-sm font-black text-slate-800 uppercase mb-6 tracking-widest">Communes</h3>
                <form onSubmit={handleAddCommune} className="flex gap-2 mb-6">
                  <input type="text" placeholder="Ajouter une zone..." className="flex-1 px-4 py-3 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={newCommune} onChange={(e) => setNewCommune(e.target.value)} />
                  <button type="submit" className="p-3 bg-indigo-600 text-white rounded-xl shadow-md"><Plus size={18}/></button>
                </form>
                <div className="space-y-2">
                  {communes.map(c => (
                    <div key={c} className="p-3 bg-slate-50 rounded-xl text-[11px] font-black text-slate-600 uppercase flex justify-between items-center group transition-all hover:bg-slate-100">
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* POPUP RÉSERVATION CLIENT */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative overflow-hidden">
            {bookingSuccess ? (
              <div className="text-center py-10 animate-in zoom-in">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Demande envoyée !</h3>
                <p className="text-slate-400 font-bold text-sm">Notre équipe vous contactera dans les plus brefs délais.</p>
              </div>
            ) : (
              <>
                <button onClick={() => setIsBookingModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900"><X size={24} /></button>
                <div className="mb-8">
                  <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
                    <Calendar size={28} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">Réserver ce séjour</h3>
                  <p className="text-slate-400 text-sm font-bold uppercase mt-1 tracking-widest">{bookingTarget?.nom}</p>
                </div>
                <form onSubmit={handleBookingSubmit} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom complet</label>
                    <input required type="text" placeholder="Ex: Jean Kouadio" className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold mt-1 text-sm" value={bookingForm.name} onChange={(e) => setBookingForm({...bookingForm, name: e.target.value})}/>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Numéro de Téléphone</label>
                    <input required type="tel" placeholder="Ex: 07 00 00 00 00" className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold mt-1 text-sm" value={bookingForm.phone} onChange={(e) => setBookingForm({...bookingForm, phone: e.target.value})}/>
                  </div>
                  <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100 mt-4 active:scale-95 transition-all">Confirmer la demande</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* GALERIE / DÉTAILS */}
      {selectedResidence && (
        <div className="fixed inset-0 z-[100] bg-slate-900/98 backdrop-blur-xl flex flex-col p-4 md:p-10 animate-in fade-in duration-300 overflow-y-auto">
          <button onClick={() => setSelectedResidence(null)} className="absolute top-4 right-4 z-10 p-3 bg-white/10 text-white rounded-full"><X size={28} /></button>
          <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full gap-6">
            <div className="relative w-full aspect-video flex items-center justify-center">
               <img src={selectedResidence.images[currentGalleryIndex]} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
               {selectedResidence.images.length > 1 && (
                 <>
                   <button onClick={() => setCurrentGalleryIndex(i => i === 0 ? selectedResidence.images.length-1 : i-1)} className="absolute left-0 p-3 bg-white/10 text-white rounded-full"><ChevronLeft size={24} /></button>
                   <button onClick={() => setCurrentGalleryIndex(i => i === selectedResidence.images.length-1 ? 0 : i+1)} className="absolute right-0 p-3 bg-white/10 text-white rounded-full"><ChevronRight size={24} /></button>
                 </>
               )}
            </div>
            <div className="text-center text-white">
              <h4 className="text-2xl font-black mb-1">{selectedResidence.nom}</h4>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{selectedResidence.commune} • {selectedResidence.prix.toLocaleString()} F / nuit</p>
              <button 
                onClick={() => { setSelectedResidence(null); openBooking(selectedResidence); }}
                className="mt-6 bg-white text-indigo-900 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-indigo-50 transition-colors"
              >
                Réserver immédiatement
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto p-2 no-scrollbar">
              {selectedResidence.images.map((img, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setCurrentGalleryIndex(idx)} 
                  className={`flex-shrink-0 w-20 h-14 rounded-xl overflow-hidden border-2 transition-all ${idx === currentGalleryIndex ? 'border-indigo-500 scale-110 shadow-lg' : 'border-transparent opacity-40'}`}
                >
                  <img src={img} className="w-full h-full object-cover"/>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FORMULAIRE BIEN (ADMIN) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-t-[2rem] md:rounded-[2rem] w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest text-xs">{editingResidence ? "Editer le Bien" : "Nouveau Bien Cloud"}</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-300 hover:text-slate-900"><XCircle size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-5 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Désignation</label>
                  <input required type="text" className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold mt-1 text-sm" value={formData.nom} onChange={(e) => setFormData({...formData, nom: e.target.value})}/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prix nuit (F)</label>
                    <input required type="number" className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold mt-1 text-sm" value={formData.prix} onChange={(e) => setFormData({...formData, prix: parseInt(e.target.value) || 0})}/>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                    <select className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold mt-1 text-sm appearance-none" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                      {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Commune / Zone</label>
                  <select className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold mt-1 text-sm appearance-none" value={formData.commune} onChange={(e) => setFormData({...formData, commune: e.target.value})}>
                    {communes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Disponibilité</label>
                  <select className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold mt-1 text-sm appearance-none" value={formData.etat} onChange={(e) => setFormData({...formData, etat: e.target.value})}>
                    <option value="disponible">En ligne / Disponible</option>
                    <option value="occupé">Hors ligne / Occupé</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Photos</label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {formData.images.map((img, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
                        <img src={img} className="w-full h-full object-cover"/>
                        <button type="button" onClick={() => setFormData(p => ({...p, images: p.images.filter((_, idx) => idx !== i)}))} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md opacity-0 group-hover:opacity-100"><X size={10}/></button>
                      </div>
                    ))}
                    <label className="aspect-square border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 hover:text-indigo-500 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                      <Plus size={24}/>
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload}/>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Annuler</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Sauvegarder</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="mt-20 border-t border-slate-100 py-16 bg-white px-4 text-center">
        <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.3em]">Abidjan Immo Premium • Réservation Cloud Sécurisée</p>
      </footer>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23cbd5e1'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-position: right 1.25rem center; background-repeat: no-repeat; background-size: 1.25rem; }
      `}</style>
    </div>
  );
};

export default App;
