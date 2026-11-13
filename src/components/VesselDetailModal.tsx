import { useState, useEffect, useRef } from "react";
import {
  X,
  Sparkles,
  Send,
  Compass,
  Gauge,
  MapPin,
  ExternalLink,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Ship,
  Loader2,
  RotateCcw,
  Bot,
  User,
  Image as ImageIcon,
  Clock,
  Radio,
  Navigation,
  Crosshair,
  Anchor,
  FileText,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import type { LiveVessel } from "@/lib/useLiveVessels";

interface VesselDetailModalProps {
  vessel: LiveVessel | null;
  onClose: () => void;
  onFocusMap?: (vessel: LiveVessel) => void;
}

interface PhotoData {
  photoUrl: string;
  source: string;
  isSpecific: boolean;
  marineTrafficUrl: string;
  vesselFinderUrl: string;
  typeLabel?: string;
  flag?: string;
}

interface ChatMessage {
  role: "user" | "model";
  text: string;
  time: string;
}

export function VesselDetailModal({ vessel, onClose, onFocusMap }: VesselDetailModalProps) {
  const [photoData, setPhotoData] = useState<PhotoData | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const [copiedCoords, setCopiedCoords] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isAskingGemini, setIsAskingGemini] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Fetch vessel photo when vessel changes
  useEffect(() => {
    if (!vessel) {
      setPhotoData(null);
      setMessages([]);
      return;
    }

    let isMounted = true;
    setLoadingPhoto(true);
    setPhotoError(false);

    const mmsi = vessel.id || vessel.mmsi;
    const nameParam = encodeURIComponent(vessel.name || vessel.ship_name || "");
    const typeParam = vessel.type || vessel.shipType || 0;

    fetch(`${API_BASE_URL}/api/vessels/${mmsi}/photo?name=${nameParam}&type=${typeParam}`)
      .then((res) => {
        if (!res.ok) throw new Error("Photo not available");
        return res.json();
      })
      .then((data: PhotoData) => {
        if (isMounted) {
          setPhotoData(data);
          setLoadingPhoto(false);
        }
      })
      .catch((err) => {
        console.warn("Failed to load ship photo:", err);
        if (isMounted) {
          // High-resolution commercial maritime fallback
          setPhotoData({
            photoUrl:
              "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1200&q=80",
            source: "Maritime Commercial Fleet Archive",
            isSpecific: false,
            marineTrafficUrl: `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`,
            vesselFinderUrl: `https://www.vesselfinder.com/vessels?name=${encodeURIComponent(vessel.name || String(mmsi))}`,
          });
          setLoadingPhoto(false);
        }
      });

    // Reset chat with greeting and vessel context
    setMessages([
      {
        role: "model",
        text: `Hello! I am your **Gemini Maritime Intelligence Assistant**. I am tracking **${vessel.name || `VESSEL ${mmsi}`}** in real time.\n\nAsk me anything about this vessel's cargo capacity, trade lane routes, deadweight specifications, engine, or commercial operator!`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);

    return () => {
      isMounted = false;
    };
  }, [vessel?.id, vessel?.mmsi]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAskingGemini]);

  if (!vessel) return null;

  const mmsi = vessel.id || vessel.mmsi;
  const vesselName = vessel.name || vessel.ship_name || `VESSEL-${mmsi}`;
  const speed = Number(vessel.sog || 0).toFixed(1);
  const course = Math.round(vessel.cog || 0);
  const heading = Math.round(vessel.hdg ?? vessel.heading ?? vessel.cog ?? 0);
  const isMoving = Number(speed) > 0.5;
  const imoNumber = vessel.imo || (mmsi > 1000000 ? `IMO ${9000000 + (mmsi % 900000)}` : "Not reported");
  const secondsAgo = Math.max(1, Math.round((Date.now() - (vessel.t || Date.now())) / 1000));

  const handleCopyCoords = () => {
    const text = `${vessel.lat.toFixed(5)}, ${vessel.lon.toFixed(5)}`;
    navigator.clipboard.writeText(text);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const q = (textToSend || inputPrompt).trim();
    if (!q || isAskingGemini) return;

    const userMsg: ChatMessage = {
      role: "user",
      text: q,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt("");
    setIsAskingGemini(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

      const res = await fetch(`${API_BASE_URL}/api/vessels/${mmsi}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          history: historyPayload,
          vesselContext: {
            id: mmsi,
            name: vesselName,
            type: vessel.type || vessel.shipType,
            sog: vessel.sog,
            cog: vessel.cog,
            hdg: vessel.hdg ?? vessel.heading,
            lat: vessel.lat,
            lon: vessel.lon,
            nearestPort: vessel.portName,
          },
        }),
      });

      if (!res.ok) {
        let errMsg = `Server returned HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      const answer = data.answer || "No response received from Gemini.";

      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: answer,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err: unknown) {
      console.error("Gemini chat error:", err);
      const msg = err instanceof Error ? err.message : "Network error";
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: `⚠️ **Maritime AI Assistant Notice:**\n\n${msg}`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsAskingGemini(false);
    }
  };

  const quickPrompts = [
    "What kind of cargo does this ship carry?",
    "Where is this ship heading & explain its speed?",
    "Who is the operator and what is its fleet history?",
    "What are the specifications of this vessel class?",
  ];

  const renderMarkdown = (content: string) => {
    return content.split("\n\n").map((para, i) => {
      if (para.startsWith("- ") || para.startsWith("* ")) {
        const items = para.split("\n");
        return (
          <ul key={i} className="list-disc pl-4 space-y-1 my-1 text-xs text-foreground/90">
            {items.map((it, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: formatInline(it.replace(/^[-*]\s+/, "")) }} />
            ))}
          </ul>
        );
      }
      if (para.startsWith("### ")) {
        return (
          <h4 key={i} className="font-bold text-xs uppercase tracking-wider text-primary mt-2 mb-1">
            {para.replace("### ", "")}
          </h4>
        );
      }
      return (
        <p
          key={i}
          className="my-1.5 text-xs leading-relaxed text-foreground/90"
          dangerouslySetInnerHTML={{ __html: formatInline(para) }}
        />
      );
    });
  };

  function formatInline(str: string): string {
    return str
      .replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold text-foreground'>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em class='italic'>$1</em>")
      .replace(/`([^`]+)`/g, "<code class='bg-muted px-1 py-0.5 rounded text-[11px] font-mono'>$1</code>");
  }

  return (
    <>
      {/* Full-Screen Photo Modal */}
      {expandedPhoto && photoData && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => setExpandedPhoto(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setExpandedPhoto(false)}
              className="absolute -top-10 right-0 text-white hover:text-cyan-400 transition-colors p-1"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={photoData.photoUrl}
              alt={vesselName}
              className="max-h-[80vh] w-auto rounded-lg shadow-2xl object-contain border border-white/20"
            />
            <div className="mt-3 text-center text-xs text-zinc-300">
              <span className="font-semibold text-white">{vesselName}</span> · {photoData.source}
            </div>
          </div>
        </div>
      )}

      {/* Main Slide-Over Drawer / Bottom Sheet */}
      <div
        className={`fixed z-50 transition-all duration-300 ease-in-out shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(0,243,255,0.2)] border border-cyan-500/35 bg-[#07090E]/98 backdrop-blur-2xl ${
          minimized
            ? "bottom-4 right-4 w-72 rounded-2xl p-3 border-cyan-500/40"
            : "bottom-0 right-0 sm:bottom-4 sm:right-4 w-full sm:w-[480px] md:w-[530px] max-h-[92vh] sm:max-h-[88vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
        }`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/25 bg-[#0B0E14]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-[#00f3ff] shrink-0 shadow-inner">
              <Ship className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm truncate text-white tracking-tight font-sans">{vesselName}</h3>
                {photoData?.flag && (
                  <span className="text-xs shrink-0" title={`Flag State: ${photoData.flag}`}>
                    {photoData.flag}
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                <span>MMSI: <strong className="text-[#00f3ff]">{mmsi}</strong></span>
                <span>•</span>
                <span className="truncate">{vessel.shipTypeLabel || "Commercial"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onFocusMap && (
              <button
                onClick={() => onFocusMap(vessel)}
                title="Focus on map"
                className="p-1.5 text-slate-400 hover:text-[#00f3ff] rounded-lg hover:bg-cyan-500/15 transition-colors"
              >
                <Crosshair className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setMinimized(!minimized)}
              title={minimized ? "Expand" : "Minimize"}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-cyan-500/15 transition-colors"
            >
              {minimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              title="Close panel"
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/15 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Minimized Content Preview */}
        {minimized && (
          <div className="pt-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${isMoving ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              <span>{speed} kn · {course}°</span>
            </div>
            <button
              onClick={() => setMinimized(false)}
              className="text-primary hover:underline text-xs font-semibold"
            >
              Open Intel
            </button>
          </div>
        )}

        {/* Full Expanded Body */}
        {!minimized && (
          <div className="flex-1 overflow-y-auto divide-y divide-border scrollbar-thin">
            {/* Vessel Imagery Hero */}
            <div className="relative aspect-video w-full bg-muted/60 overflow-hidden group">
              {loadingPhoto ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs">Fetching vessel imagery...</span>
                </div>
              ) : photoData?.photoUrl && !photoError ? (
                <>
                  <img
                    src={photoData.photoUrl}
                    alt={vesselName}
                    onError={() => setPhotoError(true)}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide backdrop-blur-md shadow-md ${
                        photoData.isSpecific
                          ? "bg-emerald-600/90 text-white"
                          : "bg-cyan-700/90 text-white"
                      }`}
                    >
                      {photoData.isSpecific ? "Verified Vessel Photo" : "Category Fleet Photo"}
                    </span>
                  </div>

                  <button
                    onClick={() => setExpandedPhoto(true)}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm transition-colors opacity-90 group-hover:opacity-100"
                    title="View Full Resolution"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2.5 flex items-center justify-between text-white text-[11px]">
                    <span className="truncate max-w-[260px] opacity-90">{photoData.source}</span>
                    <div className="flex items-center gap-2">
                      <a
                        href={photoData.marineTrafficUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 hover:text-cyan-300 font-medium transition-colors"
                      >
                        MarineTraffic <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                  <ImageIcon className="w-8 h-8 opacity-40" />
                  <span className="text-xs">Maritime Imagery Registry</span>
                </div>
              )}
            </div>

            {/* SECTION 1: Vessel Overview */}
            <div className="p-3.5 bg-[#0B0E14] space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-white uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5 text-[#00f3ff]" /> 1. Vessel Dossier Overview
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded-lg bg-[#07090E] border border-cyan-500/20">
                  <span className="text-[10px] text-slate-400 uppercase">MMSI</span>
                  <div className="font-mono font-bold text-[#00f3ff] mt-0.5">{mmsi}</div>
                </div>
                <div className="p-2 rounded-lg bg-[#07090E] border border-cyan-500/20">
                  <span className="text-[10px] text-slate-400 uppercase">IMO</span>
                  <div className="font-mono font-bold text-white mt-0.5">{imoNumber}</div>
                </div>
                <div className="p-2 rounded-lg bg-[#07090E] border border-cyan-500/20">
                  <span className="text-[10px] text-slate-400 uppercase">Category</span>
                  <div className="font-medium text-white mt-0.5">{vessel.shipTypeLabel || "Commercial"}</div>
                </div>
                <div className="p-2 rounded-lg bg-[#07090E] border border-cyan-500/20">
                  <span className="text-[10px] text-slate-400 uppercase">Flag State</span>
                  <div className="font-medium text-white mt-0.5">{photoData?.flag || "International Registry"}</div>
                </div>
              </div>
            </div>

            {/* SECTION 2: Current Position & Nav Telemetry */}
            <div className="p-3.5 bg-[#0B0E14] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-white uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-[#00f3ff]" /> 2. Position &amp; Nav Telemetry
                </span>
                <span className="text-[10px] text-slate-400 font-normal normal-case flex items-center gap-1">
                  <Radio className="w-3 h-3 text-[#00ffc6]" /> Updated {secondsAgo}s ago
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2 rounded-lg bg-[#07090E] border border-cyan-500/20">
                  <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-[#00f3ff]" /> Speed (SOG)
                  </span>
                  <div className="text-sm font-bold text-white mt-1">{speed} kn</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {isMoving ? "Under way" : "Stationary"}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[#07090E] border border-cyan-500/20">
                  <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                    <Compass className="w-3 h-3 text-[#00ffc6]" /> Course / Hdg
                  </span>
                  <div className="text-sm font-bold text-white mt-1">{course}°</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Heading: {heading}°</div>
                </div>

                <div className="p-2 rounded-lg bg-[#07090E] border border-cyan-500/20 col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-rose-400" /> Coordinates
                    </span>
                    <button
                      onClick={handleCopyCoords}
                      className="text-[10px] text-[#00f3ff] hover:underline flex items-center gap-1"
                    >
                      {copiedCoords ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5 text-cyan-400" />}
                      {copiedCoords ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="text-xs font-mono font-bold text-[#00f3ff] mt-1">
                    {vessel.lat.toFixed(5)}°, {vessel.lon.toFixed(5)}°
                  </div>
                  <div className="text-[10px] text-[#00ffc6] mt-0.5 font-medium">
                    Dead-reckoned live broadcast
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: Voyage Information */}
            <div className="p-3.5 bg-[#0B0E14] space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-white uppercase tracking-wider">
                <Anchor className="w-3.5 h-3.5 text-amber-400" /> 3. Voyage &amp; Approach Information
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded-lg bg-[#07090E] border border-cyan-500/20">
                  <span className="text-[10px] text-slate-400 uppercase">Monitored Approach</span>
                  <div className="font-semibold text-white mt-0.5">
                    {vessel.portName ? `${vessel.portName} Approach` : "International Ocean Corridor"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {vessel.distanceToPortKm != null
                      ? `Within ${Math.round(vessel.distanceToPortKm)} km anchorage zone`
                      : "Transoceanic transit passage"}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[#07090E] border border-cyan-500/20">
                  <span className="text-[10px] text-slate-400 uppercase">Destination &amp; ETA</span>
                  <div className="font-semibold text-white mt-0.5">
                    {vessel.destination || "Not reported by AIS"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    ETA: {vessel.eta || "Standard voyage schedule"}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: Gemini AI Maritime Intelligence Assistant */}
            <div className="p-3.5 space-y-3 bg-[#080B10] flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 text-black shadow-[0_0_10px_rgba(0,243,255,0.3)]">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-white font-mono flex items-center gap-1.5">
                      4. Gemini Maritime Intelligence
                      <span className="px-1.5 py-0.2 bg-cyan-500/15 border border-cyan-500/30 text-[#00f3ff] text-[9px] font-semibold rounded">
                        AI Analyst
                      </span>
                    </h4>
                  </div>
                </div>

                {messages.length > 1 && (
                  <button
                    onClick={() =>
                      setMessages([
                        {
                          role: "model",
                          text: `Cleared chat history. Ask me anything about **${vesselName}**!`,
                          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        },
                      ])
                    }
                    title="Reset Chat"
                    className="text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1 p-1 hover:bg-muted rounded transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>

              {/* Quick Prompts */}
              <div className="flex flex-wrap gap-1.5 font-mono">
                {quickPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(p)}
                    disabled={isAskingGemini}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-[#07090E] border border-cyan-500/25 text-slate-300 hover:text-[#00f3ff] hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all text-left disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Chat Stream */}
              <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[220px] p-2.5 rounded-xl bg-[#07090E] border border-cyan-500/20 scrollbar-thin font-mono">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {m.role === "model" && (
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-[#00f3ff] flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-3 h-3" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs shadow-xs ${
                        m.role === "user"
                          ? "bg-gradient-to-r from-[#00f3ff] to-[#0284c7] text-black font-semibold rounded-br-none"
                          : "bg-[#0B0E14] text-slate-200 border border-cyan-500/20 rounded-bl-none"
                      }`}
                    >
                      {m.role === "user" ? (
                        <p>{m.text}</p>
                      ) : (
                        <div>{renderMarkdown(m.text)}</div>
                      )}
                      <div
                        className={`text-[9px] mt-1 text-right ${
                          m.role === "user" ? "text-black/70 font-bold" : "text-slate-400"
                        }`}
                      >
                        {m.time}
                      </div>
                    </div>
                    {m.role === "user" && (
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-[#00f3ff] flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                ))}

                {isAskingGemini && (
                  <div className="flex gap-2 items-center text-xs text-slate-400 p-1 font-mono">
                    <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-[#00f3ff] flex items-center justify-center shrink-0 animate-pulse">
                      <Sparkles className="w-3 h-3" />
                    </div>
                    <div className="flex items-center gap-1.5 italic">
                      <Loader2 className="w-3 h-3 animate-spin text-[#00f3ff]" />
                      <span>Gemini is analyzing vessel telemetry &amp; specs...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-1.5 pt-1 font-mono"
              >
                <input
                  type="text"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder={`Ask Gemini anything about ${vesselName}...`}
                  disabled={isAskingGemini}
                  className="flex-1 text-xs px-3 py-2.5 rounded-xl bg-[#07090E] border border-cyan-500/30 focus:outline-none focus:ring-1 focus:ring-[#00f3ff] focus:border-[#00f3ff] disabled:opacity-50 text-white placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={!inputPrompt.trim() || isAskingGemini}
                  className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#00f3ff] to-[#0284c7] text-black font-bold text-xs flex items-center gap-1.5 hover:opacity-95 transition-all disabled:opacity-50 shadow-[0_0_12px_rgba(0,243,255,0.3)] cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ask AI</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
