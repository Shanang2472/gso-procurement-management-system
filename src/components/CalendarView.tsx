import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface CalendarEvent {
  date: Date;
  title: string;
  type: 'deadline' | 'bid_opening' | 'delivery';
  reference?: string;
  purpose?: string;
  requestedBy?: string;
  department?: string;
  status?: string;
}

interface CalendarViewProps {
  events: CalendarEvent[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ events }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getEventsForDay = (day: number) => {
    return events.filter(event => 
      event.date.getDate() === day &&
      event.date.getMonth() === currentDate.getMonth() &&
      event.date.getFullYear() === currentDate.getFullYear()
    );
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-2">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-1 rounded hover:bg-slate-100">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-1 rounded hover:bg-slate-100">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500 font-bold uppercase mb-2">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {blanks.map(b => <div key={`blank-${b}`} className="h-16" />)}
        {days.map(day => {
          const dayEvents = getEventsForDay(day);
          return (
            <div key={day} className="h-16 border border-slate-100 rounded p-1 text-xs">
              <span className="font-bold">{day}</span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.map((event, i) => (
                  <button
                    key={`${event.title}-${i}`}
                    type="button"
                    onClick={() => setSelectedEvent(event)}
                    title="View request details"
                    className={`block w-full text-left text-[9px] truncate px-1 rounded cursor-pointer hover:ring-2 hover:ring-slate-300 ${
                      event.type === 'deadline' ? 'bg-rose-100 text-rose-800' :
                      event.type === 'bid_opening' ? 'bg-amber-100 text-amber-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {event.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setSelectedEvent(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {selectedEvent.type === 'deadline' ? 'Purchase Request' : selectedEvent.type === 'bid_opening' ? 'Bidding Schedule' : 'Purchase Order'}
                </p>
                <h4 className="mt-1 text-base font-bold text-slate-800">{selectedEvent.title}</h4>
              </div>
              <button type="button" onClick={() => setSelectedEvent(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close details">
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs text-slate-700">
              <p><span className="font-semibold text-slate-500">Date:</span> {selectedEvent.date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              {selectedEvent.reference && <p><span className="font-semibold text-slate-500">Request:</span> {selectedEvent.reference}</p>}
              {selectedEvent.requestedBy && <p><span className="font-semibold text-slate-500">Scheduled/requested by:</span> {selectedEvent.requestedBy}</p>}
              {selectedEvent.department && <p><span className="font-semibold text-slate-500">Department:</span> {selectedEvent.department}</p>}
              {selectedEvent.purpose && <p><span className="font-semibold text-slate-500">Purpose:</span> {selectedEvent.purpose}</p>}
              {selectedEvent.status && <p><span className="font-semibold text-slate-500">Status:</span> {selectedEvent.status.replace('_', ' ')}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
