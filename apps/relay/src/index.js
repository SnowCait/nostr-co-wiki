import { DurableObject } from 'cloudflare:workers';

export class Wiki extends DurableObject {
  fetch() {
    return new Response('Not Found', { status: 404 });
  }
}

export default {
  fetch() {
    return new Response('Not Found', { status: 404 });
  }
};
