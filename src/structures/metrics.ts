import { MetricValuesStatistics, TimeSpanValues, TimeSpanMetric, ScalarValues, ScalarMetricValues, ScalarMetric, ScalarMetricLabel, TimeSpanMetricLabel } from "../types/metrics";
import { ulid } from 'ulid';
import { Logger } from "../logger";

const logger = new Logger('Metrics');

class Metrics {
    protected activeTimeSpanMetrics: Record<string, TimeSpanMetric> = {};
    protected scalarValues: ScalarValues = {};
    protected timeSpanValues: TimeSpanValues = {};

    public saveScalarMetricValue(label: ScalarMetricLabel, value: number): void {
        if (!this.scalarValues[label]) {
            this.scalarValues[label] = {
                [Date.now()]: value,
            }
        } else {
            this.scalarValues[label][Date.now()] = value;
        }
    }

    public getTimeSpanMetricValues(label: TimeSpanMetricLabel): TimeSpanMetric[] {
        let specificTimeSpanValue = this.timeSpanValues[label];
        if (!specificTimeSpanValue) {
            specificTimeSpanValue = [];
        }
        return specificTimeSpanValue;
    }

    public getScalarStatistics(label: ScalarMetricLabel): MetricValuesStatistics {
        let min = 0;
        let max = 0;
        let sum = 0;
        let count = 1;
        if (!this.scalarValues[label]) {
            this.scalarValues[label] = {};
        }
        Object.values(this.scalarValues[label]).forEach((value, idx) => {
            min = value < min ? value : min;
            max = value < max ? value : max;
            sum += value;
            count = idx + 1;
        });
        return {
            average: sum / (count ?? 1),
            min,
            max,
            sum,
        }
    }

    public getTimeSpanStatistics(label: TimeSpanMetricLabel): MetricValuesStatistics {
        let min = 0;
        let max = 0;
        let sum = 0;
        let count = 1;
        
        let specificTimeSpanValue = this.timeSpanValues[label];
        if (!specificTimeSpanValue) {
            specificTimeSpanValue = [];
        }
        Object.values(specificTimeSpanValue).forEach((value, idx) => {
            if (!value.end) return;
            const span = value.end - value.start;
            min = span < min ? span : min;
            max = span < max ? span : max;
            sum += span;
            count = idx + 1;
        });
        return {
            average: sum / (count ?? 1),
            min,
            max,
            sum,
        }
    }    

    public start(label: TimeSpanMetricLabel): string {
        const id = ulid();
        this.activeTimeSpanMetrics[id] = {
            id,
            label,
            start: Date.now(),
        }
        return id;
    }

    public stop(id: string): void {
        const activeMetric = this.activeTimeSpanMetrics[id];
        if (!activeMetric) {
            logger.warn(`Could not find metric to stop. Id: ${id}`);
        }
        const finishedMetric = {
            ...activeMetric,
            end: Date.now(),
        };

        logger.debug(`Metric ended. Label: ${finishedMetric.label} Value: ${finishedMetric.end - finishedMetric.start}ms`);

        const specificMetric = this.timeSpanValues[activeMetric.label];
        
        if (!specificMetric) {
            this.timeSpanValues[activeMetric.label] = [finishedMetric];
            return;
        }
        specificMetric.push(finishedMetric);
    }
}

export const metrics = new Metrics();