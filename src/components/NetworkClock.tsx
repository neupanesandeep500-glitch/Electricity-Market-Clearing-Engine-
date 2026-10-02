import React, { useState, useEffect } from 'react';
import { Clock, Globe } from 'lucide-react';

export const NetworkClock: React.FC = () => {
  const [time, setTime] = useState<Date>(new Date());
  const [timeZone, setTimeZone] = useState<string>('UTC');
  const [is24Hour, setIs24Hour] = useState<boolean>(false);

  // Initialize and auto-detect network timezone
  useEffect(() => {
    try {
      const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detectedZone) {
        setTimeZone(detectedZone);
      }
    } catch (e) {
      console.warn('Failed to detect timezone:', e);
    }

    // Tick every second precisely
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format dynamic parts according to the detected network timezone
  const dayName = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone,
  }).format(time);

  const dateStr = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(time);

  const formattedTime = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: !is24Hour,
    timeZone,
  }).format(time);

  // Calculate UTC offset
  const offsetMinutes = -time.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absMin / 60);
  const offsetRemMin = absMin % 60;
  const offsetStr = `UTC${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetRemMin).padStart(2, '0')}`;

  // Clean timezone label (e.g., "Asia/Kathmandu" -> "Kathmandu" or full string)
  const shortZone = timeZone.includes('/') ? timeZone.split('/')[1].replace(/_/g, ' ') : timeZone;

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/20 text-white shadow-sm select-none"
      title={`Network Synchronized Time\nTimezone: ${timeZone} (${offsetStr})\nClick time to toggle 12h/24h`}
    >
      {/* Pulsing Live indicator */}
      <div className="flex items-center gap-1.5 shrink-0 pr-1 border-r border-white/15">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <Clock className="w-3.5 h-3.5 text-amber-300" />
      </div>

      {/* Date & Day */}
      <div className="flex flex-col text-left leading-tight shrink-0">
        <span className="text-[11px] font-bold text-amber-300 tracking-wide">
          {dayName}
        </span>
        <span className="text-[10px] font-medium text-slate-300">
          {dateStr}
        </span>
      </div>

      {/* Live Digital Clock with Seconds */}
      <button
        type="button"
        onClick={() => setIs24Hour(!is24Hour)}
        className="font-mono text-sm sm:text-base font-extrabold tracking-wider text-white px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 border border-white/10 transition-colors cursor-pointer text-center"
        title="Click to toggle between 12-hour and 24-hour format"
      >
        {formattedTime}
      </button>

      {/* Auto-Adjusted Network Timezone Badge */}
      <div className="hidden lg:flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-950/70 border border-indigo-400/30 text-indigo-200 shrink-0">
        <Globe className="w-3 h-3 text-cyan-300 shrink-0" />
        <span className="truncate max-w-[90px]" title={timeZone}>
          {shortZone}
        </span>
        <span className="text-white/40 font-mono text-[9px]">{offsetStr}</span>
      </div>
    </div>
  );
};
