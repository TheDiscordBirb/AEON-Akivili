import { 
    DataType,
    Data,
    ValidatedEventData,
    ValidatedCommandData,
    CommandData,EventData
} from "../types/central-logic-unit";

class MainProcessingUnit {
    async processData(data: Data) {
        switch(data.type) {
            case DataType.COMMAND:
                await this.handleCommand(data);
                break;
            case DataType.EVENT:
                await this.handleEvent(data);
                break;
            default:
                throw new Error("Invalid data type.");
        }
    }


    async handleCommand(data: Data) {
        const validatedCommandData = await this.validateCommandData(data);
    }

    async validateCommandData(data: Data): Promise<ValidatedCommandData> {
        let resultData: CommandData;
        try {
            resultData = data.data as CommandData;
        } catch (e) {
            throw new Error((e as Error).message);
        }
        return {data: resultData};
    }

    async handleEvent(data: Data) {
        const validatedEventData = await this.validateEventData(data);
    }

    async validateEventData(data: Data): Promise<ValidatedEventData> {
        let resultData: EventData;
        try {
            resultData = data.data as EventData;
        } catch(e) {
            throw new Error((e as Error).message)
        }
        return {data: resultData};
    }
}

export const MPU = new MainProcessingUnit();