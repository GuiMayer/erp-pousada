import { ApiAdapter } from "./api-adapter"

export class DatabaseApiAdapter extends ApiAdapter {
  constructor() {
    super({
      baseUrl: "/api/data",
      timeout: 15000,
    })
  }
}
