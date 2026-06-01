import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';

@Injectable()
export class StructuredLogger extends ConsoleLogger {
  protected printMessages(
    messages: unknown[],
    context = '',
    logLevel: LogLevel = 'log',
    writeStreamType?: 'stdout' | 'stderr',
  ) {
    const stream = writeStreamType === 'stderr' ? process.stderr : process.stdout;

    for (const message of messages) {
      stream.write(
        `${JSON.stringify({
          timestamp: new Date().toISOString(),
          level: logLevel,
          context: context || this.context,
          message: this.formatStructuredMessage(message),
        })}\n`,
      );
    }
  }

  private formatStructuredMessage(message: unknown): unknown {
    if (message instanceof Error) {
      return {
        name: message.name,
        message: message.message,
        stack: message.stack,
      };
    }

    return message;
  }
}
