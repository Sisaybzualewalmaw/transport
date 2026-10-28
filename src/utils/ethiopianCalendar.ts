/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Ethiopian Calendar month names in Amharic and English phonetics
export const ETHIOPIAN_MONTHS = [
  { am: 'መስከረም', en: 'Meskerem', index: 1 },
  { am: 'ጥቅምት', en: 'Tikimt', index: 2 },
  { am: 'ኅዳር', en: 'Hidar', index: 3 },
  { am: 'ታኅሣሥ', en: 'Tahsas', index: 4 },
  { am: 'ጥር', en: 'Tir', index: 5 },
  { am: 'የካቲት', en: 'Yekatit', index: 6 },
  { am: 'መጋቢት', en: 'Megabit', index: 7 },
  { am: 'ሚያዝያ', en: 'Miyazya', index: 8 },
  { am: 'ግንቦት', en: 'Ginbot', index: 9 },
  { am: 'ሰኔ', en: 'Sene', index: 10 },
  { am: 'ሐምሌ', en: 'Hamle', index: 11 },
  { am: 'ነሐሴ', en: 'Nehase', index: 12 },
  { am: 'ጳጉሜ', en: 'Pagume', index: 13 },
];

export interface EthiopianDate {
  year: number;
  month: number;
  monthNameAm: string;
  monthNameEn: string;
  day: number;
  formattedAm: string;
  formattedEn: string;
}

/**
 * Converts a Gregorian date (Date object or ISO string) to Ethiopian Calendar.
 * Algorithm uses the established JDN (Julian Day Number) offset calculation for accurate conversion.
 */
export function toEthiopianDate(gregorianInput: Date | string | number): EthiopianDate {
  const date = new Date(gregorianInput);
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();

  // Gregorian to JDN conversion
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jdn =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;

  // JDN to Ethiopian Date conversion (Era of the Incarnation)
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const ethYear =
    4 * Math.floor((jdn - 1723856) / 1461) +
    Math.floor(r / 365) -
    Math.floor(r / 1460);
  const ethMonth = Math.floor(n / 30) + 1;
  const ethDay = (n % 30) + 1;

  const monthObj = ETHIOPIAN_MONTHS[Math.min(ethMonth - 1, 12)] || ETHIOPIAN_MONTHS[0];

  return {
    year: ethYear,
    month: ethMonth,
    monthNameAm: monthObj.am,
    monthNameEn: monthObj.en,
    day: ethDay,
    formattedAm: `${monthObj.am} ${ethDay} ቀን ${ethYear} ዓ.ም`,
    formattedEn: `${monthObj.en} ${ethDay}, ${ethYear} E.C.`,
  };
}

/**
 * Formats both calendars together for display on tickets and manifests
 */
export function formatDualDate(gregorianInput: Date | string): {
  gregorian: string;
  ethiopian: string;
  combined: string;
} {
  const gDate = new Date(gregorianInput);
  const eth = toEthiopianDate(gDate);

  const gFormatted = gDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const gTime = gDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    gregorian: `${gFormatted} (${gTime})`,
    ethiopian: `${eth.formattedAm} (${gTime})`,
    combined: `${gFormatted} / ${eth.formattedAm}`,
  };
}
