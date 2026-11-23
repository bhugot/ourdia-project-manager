// Dates shown in Paris time.
const DAY_TIME = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});
const DATE = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' });

/** `23/11 21:18` */
export const dayTime = value => DAY_TIME.format(new Date(value)).replace(',', '').replace(' à ', ' ');
/** `10 janvier 2027` */
export const longDate = value => DATE.format(new Date(value));
