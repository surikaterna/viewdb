import { createContractToken } from '@scomp/core';
import type { ViewDbScompContract } from './types';

/** Scomp contract token binding the ViewDB RPC contract to a service name */
export const ViewDbContract = createContractToken<ViewDbScompContract>('viewdb');
