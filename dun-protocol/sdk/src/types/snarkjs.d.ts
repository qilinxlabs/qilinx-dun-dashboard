declare module 'snarkjs' {
    export namespace groth16 {
        export function fullProve(
            input: any,
            wasmFile: string,
            zkeyFile: string
        ): Promise<{ proof: any; publicSignals: string[] }>;

        export function verify(
            vkey: any,
            publicSignals: string[],
            proof: any
        ): Promise<boolean>;
    }
}
