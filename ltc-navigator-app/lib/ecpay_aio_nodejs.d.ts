// `ecpay_aio_nodejs` ships no type definitions. Declaring it `any` here is
// enough — lib/ecpay.ts is the only place that touches it, and it treats
// the client as a loosely-typed SDK object by design.
declare module "ecpay_aio_nodejs";
