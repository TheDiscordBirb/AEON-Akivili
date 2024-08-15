export enum TimeSpanMetricLabel {
    CMD_BAN  = 'Ban Command execution time',
    MESSAGE_CREATED = 'Message Created event execution time',
    CMD_REMOVE_REACTION = 'Remove Reaction Command execution time',
}

export enum ScalarMetricLabel {
}

export interface ScalarMetric {
    id: string;
    label: ScalarMetricLabel;
    value: number;
}

export type ScalarMetricValues = Record<number, number>;

export type ScalarValues = Record<ScalarMetricLabel, ScalarMetricValues>;

export interface TimeSpanMetric {
    id: string;
    label: TimeSpanMetricLabel;
    start: number;
    end?: number;
}

export type TimeSpanValues = Partial<Record<TimeSpanMetricLabel, TimeSpanMetric[]>>;

export interface MetricValuesStatistics {
    average: number;
    min: number;
    max: number;
    sum: number;
}
