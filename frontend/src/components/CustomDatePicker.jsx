import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const SearchableSelect = ({ options, value, onChange, placeholder, widthClass = "w-24" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.label.toString().toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`relative ${widthClass}`} ref={containerRef}>
      <input
        type="text"
        className="w-full bg-transparent text-white font-bold text-sm tracking-wider focus:outline-none hover:bg-white/5 rounded px-2 py-0.5 text-center cursor-text transition-colors"
        value={isOpen ? search : options.find(o => o.value === value)?.label || ""}
        placeholder={placeholder}
        onFocus={() => { setIsOpen(true); setSearch(""); }}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && filteredOptions.length > 0) {
            onChange(filteredOptions[0].value);
            setIsOpen(false);
            e.target.blur();
          }
          if (e.key === "Escape") {
            setIsOpen(false);
            e.target.blur();
          }
        }}
      />
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-28 max-h-48 overflow-y-auto bg-surface-base border border-white/10 rounded-lg shadow-xl z-50 p-1 custom-scrollbar"
          >
            {filteredOptions.length > 0 ? filteredOptions.map(opt => (
              <button
                key={opt.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-sm rounded ${opt.value === value ? 'bg-neon-purple text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'} transition-colors`}
              >
                {opt.label}
              </button>
            )) : (
              <div className="px-3 py-2 text-xs text-slate-500 text-center">No match</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CustomDatePicker = ({ value, onChange, placeholder = "Select a date...", position = "bottom" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const handlePrevMonth = (e) => {
    e.preventDefault();
    setViewDate(new Date(year, month - 1, 1));
  };
  
  const handleNextMonth = (e) => {
    e.preventDefault();
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleSelectDate = (day) => {
    // Format YYYY-MM-DD
    const newDate = new Date(year, month, day);
    const y = newDate.getFullYear();
    const m = String(newDate.getMonth() + 1).padStart(2, '0');
    const d = String(newDate.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
  };

  const isToday = (d) => {
    const today = new Date();
    return today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
  };

  const isSelected = (d) => {
    if (!value) return false;
    const [selY, selM, selD] = value.split('-');
    return parseInt(selD) === d && parseInt(selM) === month + 1 && parseInt(selY) === year;
  };

  // Build grid
  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="w-8 h-8"></div>);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const selected = isSelected(d);
    const today = isToday(d);
    
    days.push(
      <button
        key={`day-${d}`}
        onClick={(e) => { e.preventDefault(); handleSelectDate(d); }}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
          selected 
            ? 'bg-neon-purple text-white shadow-[0_0_8px_rgba(168,85,247,0.6)]' 
            : today 
              ? 'border border-neon-purple/50 text-neon-purple hover:bg-neon-purple/20' 
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
        }`}
      >
        {d}
      </button>
    );
  }

  // Format display value
  const displayValue = value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : "";

  return (
    <div className="relative flex-1" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-sm bg-surface/50 border border-white/10 shadow-sm rounded-lg px-4 py-2.5 text-white hover:border-white/20 focus:outline-none focus:border-neon-purple transition-all"
      >
        <span className={displayValue ? "text-white font-medium" : "text-slate-400"}>
          {displayValue || placeholder}
        </span>
        <Calendar size={16} className="text-slate-400" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: position === "bottom" ? -10 : 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: position === "bottom" ? -10 : 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`absolute ${position === "bottom" ? "top-full mt-2" : "bottom-full mb-2"} left-0 p-4 bg-[#0B1121] border border-white/10 rounded-xl shadow-2xl z-50 w-[280px] ${position === "top" ? "origin-bottom" : "origin-top"}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={handlePrevMonth} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1">
                <SearchableSelect
                  value={month}
                  onChange={(val) => setViewDate(new Date(year, val, 1))}
                  options={monthNames.map((m, i) => ({ label: m, value: i }))}
                  placeholder="Month"
                  widthClass="w-24"
                />
                <SearchableSelect
                  value={year}
                  onChange={(val) => setViewDate(new Date(val, month, 1))}
                  options={Array.from({ length: new Date().getFullYear() - 1970 + 1 }, (_, i) => 1970 + i).map(y => ({ label: y.toString(), value: y })).reverse()}
                  placeholder="Year"
                  widthClass="w-16"
                />
              </div>
              <button onClick={handleNextMonth} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map(d => (
                <div key={d} className="w-8 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {d}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {days}
            </div>
            
            {/* Footer */}
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/10">
              <button 
                onClick={(e) => { e.preventDefault(); onChange(""); setIsOpen(false); }}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Clear
              </button>
              <button 
                onClick={(e) => { 
                  e.preventDefault(); 
                  const today = new Date();
                  const y = today.getFullYear();
                  const m = String(today.getMonth() + 1).padStart(2, '0');
                  const d = String(today.getDate()).padStart(2, '0');
                  onChange(`${y}-${m}-${d}`);
                  setIsOpen(false);
                }}
                className="text-xs text-neon-purple font-medium hover:text-purple-400 transition-colors"
              >
                Today
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomDatePicker;
