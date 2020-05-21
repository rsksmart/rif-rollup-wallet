import React, { FC, useState, useRef, useCallback } from 'react';
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';

import { Tx } from './Transactions';
import { Transition } from 'src/components/Transition/Transition';
import { useTimeout } from 'src/hooks/timers';
import { TxStatus } from 'src/components/Transaction/TxStatus';
import { useStore } from 'src/store/context';

import { ZK_EXPLORER, ETHERSCAN_EXPLORER } from 'src/constants/links';
import { formatDate } from 'src/utils';

library.add(fas);

export const Transaction: FC<Tx> = props => {
  const {
    hash,
    tx: { amount, priority_op, type, to, token },
    created_at,
  } = props;

  const store = useStore();

  const [isCopyModal, openCopyModal] = useState<boolean>(false);
  const ref = useRef<HTMLInputElement>(null);

  const contacts = JSON.parse(
    localStorage.getItem(`contacts${store.zkWallet?.address()}`) || '[]',
  );

  const handleCopy = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el?.focus();
    el?.select();
    document.execCommand('copy');
    openCopyModal(true);
  }, [ref, openCopyModal]);

  const handleFindContactName = address =>
    contacts.filter(c => c.address.toLowerCase() === address.toLowerCase())[0];

  return (
    <div className='transaction-history-wrapper' key={hash}>
      <TxStatus tx={props} />
      <div className='transaction-history-left'>
        <div className='transaction-history-date'>{formatDate(created_at)}</div>
        <div>
          <div className={`transaction-history ${type}`}>
            <div className='transaction-history-amount'>
              {!!amount || !!priority_op?.amount
                ? parseFloat(
                    (
                      (type === 'Deposit' && priority_op
                        ? +priority_op.amount
                        : +amount) / Math.pow(10, 18)
                    )
                      .toFixed(10)
                      .toString(),
                  )
                : 'Unlocking transaction'}
            </div>
            <div className='transaction-history-hash'>
              {token && token.toString().length > 10
                ? token
                    .toString()
                    .replace(
                      token.toString().slice(6, token.toString().length - 3),
                      '...',
                    )
                : type === 'Deposit'
                ? priority_op?.token
                : token}
            </div>
          </div>
        </div>{' '}
      </div>
      <input
        type='text'
        readOnly
        className='copy-block-input'
        value={hash.toString()}
        ref={ref}
      />
      <Transition trigger={isCopyModal} timeout={200} type='fly'>
        <div className={'hint-copied open'}>{'Copied!'}</div>
      </Transition>
      <div className='transaction-history-right'>
        <div className='transaction-history-address'>
          {type === 'Transfer' && (
            <>
              <span>{'Sent to:'}</span>
              <p>
                {handleFindContactName(to)?.name
                  ? handleFindContactName(to).name
                  : to?.replace(to?.slice(6, to?.length - 3), '...')}
              </p>
            </>
          )}
          {type === 'Deposit' && (
            <>
              <span>{'Deposited to:'}</span>
              <p>{'Your account'}</p>
            </>
          )}
          {type === 'Withdraw' && (
            <>
              <span>{'Withdrawn to:'}</span>
              <p>
                {handleFindContactName(to)?.name
                  ? handleFindContactName(to).name
                  : to?.replace(to?.slice(6, to?.length - 3), '...')}
              </p>
            </>
          )}
        </div>
      </div>
      <a
        className='contact-manage-copy btn-tr'
        title='View in block explorer'
        target='_blank'
        href={`${
          type === 'Deposit' ? ETHERSCAN_EXPLORER : ZK_EXPLORER
        }/${hash}`}
      >
        <FontAwesomeIcon icon={['fas', 'external-link-alt']} />
      </a>
    </div>
  );
};
