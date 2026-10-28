/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TicketReservation, ScheduledTrip, Route, Vehicle, TerminalStation } from '../types';
import { formatDualDate } from '../utils/ethiopianCalendar';
import { Printer, X, CheckCircle2, ShieldCheck } from 'lucide-react';
import { VEHICLE_CONFIGS } from '../services/tariffEngine';

interface BoardingPassModalProps {
  ticket: TicketReservation;
  trip?: ScheduledTrip;
  route?: Route;
  vehicle?: Vehicle;
  origin?: TerminalStation;
  destination?: TerminalStation;
  onClose: () => void;
}

export const BoardingPassModal: React.FC<BoardingPassModalProps> = ({
  ticket,
  trip,
  route,
  vehicle,
  origin,
  destination,
  onClose,
}) => {
  const dualDeparture = trip ? formatDualDate(trip.departureTime) : { gregorian: 'N/A', ethiopian: 'N/A', combined: 'N/A' };
  const dualIssued = formatDualDate(ticket.issuedAt);

  const vehicleConfig = vehicle ? VEHICLE_CONFIGS[vehicle.level] : null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white text-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header Bar */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm tracking-wide">Official Boarding Pass</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
              title="Print Receipt"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Ethiopian Terminal Ticket Body */}
        <div className="p-6 font-mono text-sm space-y-4 print:p-0">
          {/* Official Letterhead */}
          <div className="text-center border-b border-dashed border-slate-300 pb-3">
            <div className="text-xs text-slate-500 uppercase tracking-widest font-sans">
              የኢትዮጵያ ትራንስፖርት ባለሥልጣን
            </div>
            <div className="text-lg font-extrabold text-slate-900 tracking-tight font-sans">
              የወልዲያ መነሀሪያ የትራንስፖርት ቲኬት
            </div>
            <div className="text-xs text-slate-600 font-sans">
              Woldia Terminal Passenger Dispatch Voucher
            </div>
            <div className="text-[11px] text-emerald-700 font-bold mt-1 bg-emerald-50 py-0.5 px-2 rounded-full inline-block border border-emerald-200">
              {ticket.status === 'CHECKED_IN' ? '✓ BOARDED & CHECKED-IN' : '✓ OFFICIAL PAID RESERVATION'}
            </div>
          </div>

          {/* Quick Metrics (Ticket No, Plate, Seat) */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">የቲኬት ቁጥር / Ticket No:</span>
              <span className="font-bold text-slate-900 text-sm">{ticket.ticketNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 block">የታርጋ ቁጥር / Plate No:</span>
              <span className="font-bold text-slate-900 text-sm">{vehicle?.licensePlate || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">የአውቶቡስ ደረጃ / Level:</span>
              <span className="font-bold text-slate-900">{vehicleConfig?.name || 'Level 2'}</span>
            </div>
            <div className="bg-emerald-100 p-1.5 rounded border border-emerald-300">
              <span className="text-emerald-800 font-bold block text-[11px]">የተመደበ ወንበር / SEAT:</span>
              <span className="font-extrabold text-emerald-950 text-base">{ticket.seatCoordinate} (ቁጥር {ticket.seatNumber})</span>
            </div>
          </div>

          {/* Route & Passenger Information */}
          <div className="space-y-1.5 text-xs border-b border-slate-200 pb-3">
            <div className="flex justify-between">
              <span className="text-slate-500">የመንገደኛ ስም / Passenger:</span>
              <span className="font-bold text-slate-900">{ticket.passengerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ስልክ ቁጥር / Phone:</span>
              <span className="font-bold text-slate-900">{ticket.passengerPhone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">የጉዞ መስመር / Route:</span>
              <span className="font-bold text-slate-900">
                {origin?.name || 'Woldia'} ➔ {destination?.name || 'Addis Ababa'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">የመነሻ ሰዓት / Departure:</span>
              <span className="font-bold text-slate-900">{dualDeparture.gregorian}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span className="text-slate-500">የኢትዮጵያ ቀን / Eth Date:</span>
              <span className="font-semibold">{dualDeparture.ethiopian}</span>
            </div>
          </div>

          {/* Fare Breakdown (Section 4.7.1) */}
          <div className="space-y-1 text-xs border-b border-dashed border-slate-300 pb-3">
            <div className="flex justify-between text-slate-600">
              <span>የጉዞ ታሪፍ / Base Fare:</span>
              <span>{(ticket.fareAmount - 10).toFixed(2)} ETB</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>የመናኸሪያ አገልግሎት ክፍያ / Station Fee:</span>
              <span>10.00 ETB</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
              <span>ጠቅላላ ክፍያ / Total Paid:</span>
              <span className="text-emerald-700">{ticket.fareAmount.toFixed(2)} ETB</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>የክፍያ ዘዴ / Payment:</span>
              <span className="uppercase font-semibold">{ticket.paymentMethod}</span>
            </div>
          </div>

          {/* QR Code Verification Section */}
          <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
              <QRCodeSVG
                value={ticket.verificationCode}
                size={140}
                level="H"
                includeMargin={false}
              />
            </div>
            <div className="mt-2 text-center">
              <div className="text-[11px] text-slate-500">የማረጋገጫ ኮድ / Verification Code:</div>
              <div className="font-bold tracking-widest text-slate-900 text-sm">
                {ticket.verificationCode}
              </div>
            </div>
          </div>

          {/* Disclaimer Footer */}
          <div className="text-center text-[10px] text-slate-500 space-y-0.5 pt-1">
            <p>ለአንድ ጊዜ ጉዞ ብቻ የሚያገለግል! ስለመረጡን እናመሰግናለን!</p>
            <p>Non-transferable single seat voucher. Valid only on departure date.</p>
            <p className="text-slate-400 font-sans">ታተመ በ / Issued: {dualIssued.gregorian}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Boarding Pass
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-white hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-300 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
