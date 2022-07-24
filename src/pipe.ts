import { StateHandler, stateHandler } from './state';
import { Request, Response } from './types';

export type MiddlewareArgType =
  | PipeableMiddleware
  | [PipeableMiddleware, Option];

export type PipeMiddleware = (
  req: Request,
  res: Response,
  middlewares: MiddlewareArgType[]
) => Promise<Response>;

type Option = {
  matcher?: (req: Request) => boolean | Promise<boolean>;
};

export type PipeableMiddleware = (
  req: Request,
  res: Response,
  handler?: {
    breakOnce: (res: Response) => Response;
    breakAll: (res: Response) => Response;
  }
) => Promise<Response>;

type Pipe = (
  req: Request,
  res: Response,
  middlewares: MiddlewareArgType[],
  stateHandler: StateHandler
) => Promise<Response>;

export const pipe: Pipe = async (req, res, middlewares, handler) => {
  if (middlewares.length === 0) {
    return res;
  }
  const [next, ...rest] = middlewares;
  const [middleware, option] =
    typeof next === 'function' ? [next, null] : [next[0], next[1]];

  if (option?.matcher && !option.matcher(req)) {
    return pipe(req, res, rest, handler);
  }

  const { getState, dispatch } = handler;
  const result = await middleware(req, res, {
    breakOnce: (res) => {
      dispatch({ type: 'breakOnce' });
      return res;
    },
    breakAll: () => {
      dispatch({ type: 'breakAll' });
      return res;
    },
  });

  const { brokenOnce, brokenAll } = getState();
  if (brokenOnce || brokenAll) {
    return result;
  }

  return pipe(req, result, rest, handler);
};

export const pipeMiddleware: PipeMiddleware = (req, res, middlewares) =>
  pipe(req, res, middlewares, stateHandler);