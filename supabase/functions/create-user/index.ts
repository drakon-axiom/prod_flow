import { makeCreateUserHandler } from './handler.mjs'

Deno.serve(makeCreateUserHandler((name: string) => Deno.env.get(name)))
