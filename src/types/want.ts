import {Want} from '/BYUI/TradeEquilizer/src/types/index';

// Summary type for Want, used in lists where full details are not needed
export interface wantSummary extends Pick<Want, 'id' | 'itemId'| 'quantity' | 'priority'> {}