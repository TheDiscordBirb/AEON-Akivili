
import process from 'node:process';

export const getEnvVar = <T>(id: string): T => {
    let result;
    try {
        result = process.env[id] as T;
    } catch (error) {
        throw Error(`Could not obtain environment variable. Id:${id}. Error: ${(error as Error).message}`);
    }
    if (!result) {
        throw Error(`Requested environment variable ${id} is undefined`);
    }
    return result;
}
