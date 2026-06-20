import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  eventNameMatches,
  redactEvent,
  type TelemetryEnvironment,
  type TelemetrySurface,
  type WideEvent
} from "./events.js";

export type TelemetryQuery = {
  environment?: TelemetryEnvironment;
  surface?: TelemetrySurface;
  event?: string;
  journey?: string;
  traceId?: string;
  correlationId?: string;
  journeyId?: string;
};

export class JsonlTelemetryStore {
  constructor(private readonly path: string) {}

  async append(event: WideEvent): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(event)}\n`, "utf8");
  }

  async query(query: TelemetryQuery): Promise<WideEvent[]> {
    const events = await this.readEvents();

    return this.applyQuery(events, query).map(redactEvent).sort(compareTimestamp);
  }

  async timeline(query: TelemetryQuery): Promise<WideEvent[]> {
    const events = await this.readEvents();

    return this.applyQuery(events, query).map(redactEvent).sort(compareTimestamp);
  }

  private applyQuery(events: WideEvent[], query: TelemetryQuery): WideEvent[] {
    return events
      .filter((event) => !query.environment || event.environment === query.environment)
      .filter((event) => !query.surface || event.surface === query.surface)
      .filter((event) => !query.event || eventNameMatches(event.name, query.event))
      .filter((event) => !query.journey || event.journey === query.journey)
      .filter((event) => !query.traceId || event.traceId === query.traceId)
      .filter((event) => !query.correlationId || event.correlationId === query.correlationId)
      .filter((event) => !query.journeyId || event.journeyId === query.journeyId);
  }

  private async readRaw(): Promise<string> {
    try {
      return await readFile(this.path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return "";
      }
      throw error;
    }
  }

  private async readEvents(): Promise<WideEvent[]> {
    const raw = await this.readRaw();
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line) as WideEvent;
        } catch (error) {
          throw new Error(
            `Invalid telemetry JSONL at line ${index + 1}: ${(error as Error).message}`
          );
        }
      });
  }
}

function compareTimestamp(a: WideEvent, b: WideEvent): number {
  return a.timestamp.localeCompare(b.timestamp);
}
