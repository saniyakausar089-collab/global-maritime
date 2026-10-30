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
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import type { LiveVessel } from "@/lib/useLiveVessels";

interface VesselDetailModalProps {
  vessel: LiveVessel | null;
  onClose: () => void;
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

export function VesselDetailModal({ vessel, onClose }: VesselDetailModalProps) {
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
          // High-res commercial maritime fallback
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

  const handleCopyCoords = () => {
    const text = `${vessel.lat.toFixed(4)}, ${vessel.lon.toFixed(4)}`;
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
        throw new Error(`Server returned HTTP ${res.status}`);
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
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: `⚠️ **Unable to complete AI query:** ${err instanceof Error ? err.message : "Network error"}. The vessel is navigating at **${speed} knots** on course **${course}°**.`,
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

  // Helper to render simple markdown formatting
  const renderMarkdown = (content: string) => {
    return content.split("\n\n").map((para, i) => {
      // Bullet list handling
      if (para.startsWith("- ") || para.startsWith("* ")) {
        const items = para.split("\n");
        return (
          <ul key={i} className="list-disc pl-4 space-y-1 my-1.5 text-xs text-foreground/90">
            {items.map((it, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: formatInline(it.replace(/^[-*]\s+/, "")) }} />
            ))}
          </ul>
        );
      }
      // Section header handling
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
              className="absolute -top-10 right-0 text-white hover:text-primary transition-colors p-1"
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
        className={`fixed z-50 transition-all duration-300 ease-in-out shadow-2xl border border-border bg-card/95 backdrop-blur-xl ${
          minimized
            ? "bottom-4 right-4 w-72 rounded-xl p-3 border-primary/40 shadow-primary/10"
            : "bottom-0 right-0 sm:bottom-4 sm:right-4 w-full sm:w-[480px] md:w-[520px] max-h-[92vh] sm:max-h-[88vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
        }`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
              <Ship className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm truncate text-foreground tracking-tight">{vesselName}</h3>
                {photoData?.flag && (
                  <span className="text-xs shrink-0" title={`Flag State: ${photoData.flag}`}>
                    {photoData.flag}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                <span>MMSI: <strong className="text-foreground">{mmsi}</strong></span>
                <span>•</span>
                <span className="truncate">{vessel.shipTypeLabel || "Commercial"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setMinimized(!minimized)}
              title={minimized ? "Expand" : "Minimize"}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
            >
              {minimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Minimized Content Preview */}
        {minimized && (
          <div className="pt-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${isMoving ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span>{speed} kn · {course}°</span>
            </div>
            <button
              onClick={() => setMinimized(false)}
              className="text-primary hover:underline text-xs font-medium"
            >
              Open Intel
            </button>
          </div>
        )}

        {/* Full Expanded Body */}
        {!minimized && (
          <div className="flex-1 overflow-y-auto divide-y divide-border scrollbar-thin">
            {/* 1. Vessel Photo Hero Section */}
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
                  {/* Photo Badges */}
                  <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide backdrop-blur-md shadow-md ${
                        photoData.isSpecific
                          ? "bg-emerald-500/85 text-white"
                          : "bg-blue-600/85 text-white"
                      }`}
                    >
                      {photoData.isSpecific ? "Verified Vessel Photo" : "Category Vessel Photo"}
                    </span>
                  </div>

                  <button
                    onClick={() => setExpandedPhoto(true)}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm transition-colors opacity-90 group-hover:opacity-100"
                    title="View Full Resolution"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 flex items-center justify-between text-white text-[11px]">
                    <span className="truncate max-w-[260px] opacity-90">{photoData.source}</span>
                    <div className="flex items-center gap-2">
                      <a
                        href={photoData.marineTrafficUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 hover:text-sky-300 font-medium transition-colors"
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

            {/* 2. Key Telemetry Grid */}
            <div className="p-3.5 bg-card grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1 font-medium">
                  <Gauge className="w-3 h-3 text-sky-500" /> Speed (SOG)
                </div>
                <div className="mt-1 text-sm font-bold text-foreground">
                  {speed} <span className="text-[11px] font-normal text-muted-foreground">kn</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {isMoving ? "Under way" : "Stationary"}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1 font-medium">
                  <Compass className="w-3 h-3 text-emerald-500" /> Course / Hdg
                </div>
                <div className="mt-1 text-sm font-bold text-foreground flex items-center gap-1.5">
                  <span>{course}°</span>
                  <span
                    className="inline-block text-[10px] text-muted-foreground transform transition-transform"
                    style={{ transform: `rotate(${course}deg)` }}
                  >
                    ↑
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Heading: {heading}°</div>
              </div>

              <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1 font-medium">
                  <MapPin className="w-3 h-3 text-rose-500" /> Position
                </div>
                <div className="mt-1 text-xs font-bold text-foreground truncate">
                  {vessel.lat.toFixed(3)}°, {vessel.lon.toFixed(3)}°
                </div>
                <button
                  onClick={handleCopyCoords}
                  className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-0.5"
                >
                  {copiedCoords ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                  {copiedCoords ? "Copied" : "Copy Coords"}
                </button>
              </div>

              <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1 font-medium">
                  <Ship className="w-3 h-3 text-indigo-500" /> Region / Port
                </div>
                <div className="mt-1 text-xs font-bold text-foreground truncate">
                  {vessel.portName || "Open Sea"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {vessel.distanceToPortKm != null
                    ? `~${Math.round(vessel.distanceToPortKm)} km away`
                    : "Live AIS"}
                </div>
              </div>
            </div>

            {/* 3. Gemini AI Maritime Chat Section */}
            <div className="p-3.5 space-y-3 bg-muted/20 flex-1 flex flex-col min-h-[280px]">
              {/* Gemini Section Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      Gemini Maritime Intelligence
                      <span className="px-1.5 py-0.2 bg-primary/10 text-primary text-[9px] font-semibold rounded">
                        Gemini 2.5
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

              {/* Quick Prompts Pills */}
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(p)}
                    disabled={isAskingGemini}
                    className="text-[10px] px-2.5 py-1 rounded-full bg-background border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Chat Messages Stream */}
              <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[220px] p-2 rounded-xl bg-background/80 border border-border/60 scrollbar-thin">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {m.role === "model" && (
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-3 h-3" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs shadow-sm ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground font-medium rounded-br-none"
                          : "bg-muted/60 text-foreground border border-border/40 rounded-bl-none"
                      }`}
                    >
                      {m.role === "user" ? (
                        <p>{m.text}</p>
                      ) : (
                        <div>{renderMarkdown(m.text)}</div>
                      )}
                      <div
                        className={`text-[9px] mt-1 text-right ${
                          m.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        {m.time}
                      </div>
                    </div>
                    {m.role === "user" && (
                      <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                ))}

                {isAskingGemini && (
                  <div className="flex gap-2 items-center text-xs text-muted-foreground p-1">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                      <Sparkles className="w-3 h-3" />
                    </div>
                    <div className="flex items-center gap-1.5 italic">
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      <span>Gemini is analyzing vessel telemetry & specs...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-1.5 pt-1"
              >
                <input
                  type="text"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder={`Ask Gemini anything about ${vesselName}...`}
                  disabled={isAskingGemini}
                  className="flex-1 text-xs px-3 py-2 rounded-xl bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputPrompt.trim() || isAskingGemini}
                  className="px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ask</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

