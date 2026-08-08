/** Executes one low-level ASF command and validates its IPC envelope. */
import { http } from '../tools-path';
import { ASFContext } from '../../ASFContext';
import { ASFError } from '../../ASFError';
import type { ASFCommandResponse } from '../../types';

export const executeCommand = async (context: ASFContext, command: string): Promise<string> => {
  const options: myAxiosConfig = {
    url: context.commandURL, method: 'POST', headers: context.headers,
    data: JSON.stringify({ Command: command })
  };
  if (context.httpsAgent) options.httpsAgent = context.httpsAgent;
  try {
    const response = await http(options);
    const envelope = response.data as ASFCommandResponse;
    if (response.status !== 200 || !envelope.Success || envelope.Message !== 'OK') {
      throw new ASFError('executeCommand', envelope.Message || `ASF returned HTTP ${response.status}`, false, response.status);
    }
    return envelope.Result || '';
  } catch (error) {
    if (error instanceof ASFError) throw error;
    throw new ASFError('executeCommand', 'Unable to execute ASF command', true, undefined, { cause: error });
  }
};
