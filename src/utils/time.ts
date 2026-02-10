export namespace Time {
    export const SECOND = 1000;
    export const MINUTE = 60 * SECOND;
    export const HOUR = 60 * MINUTE;
    export const DAY = 24 * HOUR;
    export const WEEK = 7 * DAY;
    export const YEAR = 365.25 * DAY;
    export const MONTH = YEAR/12;
    export const seconds = (quantity: number) => SECOND * quantity;
    export const minutes = (quantity: number) => MINUTE * quantity;
    export const hours = (quantity: number) => HOUR * quantity;
    export const days = (quantity: number) => DAY * quantity;
    export const weeks = (quantity: number) => WEEK * quantity;
    export const years = (quantity: number) => YEAR * quantity;
    export const months = (quantity: number) => MONTH * quantity;
}

export const sleep = (ms: number)  => new Promise(resolve => setTimeout(resolve, ms))