import '../../styles.css';

import React, { useCallback, useEffect } from 'react';
import * as R from 'remeda';
import { match } from 'ts-pattern';

import { Assistant, ChatConfig, Listeners, PostMessage, SessionOptions, SessionStatus, useTheme } from '@/common';
import { Chat, SystemResponse, UserResponse } from '@/components';
import { RuntimeAPIProvider } from '@/contexts';
import { FeedbackName, useRuntime } from '@/hooks';
import { TurnType, UserTurnProps } from '@/types';

import { ChatWindowContainer } from './styled';
import { sendMessage } from './utils';

const CALENDAR_WIDGET='calendly_widget';

const Calendar_Widget: React.FC<{url:any}> = ({url})=>{
  return (
      <div style={{height:"300px",padding:"10px"}}>
          <iframe src={url} style={{width:"100%",border:"none",overflow:"hidden",height:"300px"}} id='L7Lz4xhfeYA5OsTV0wwv_1695957160540'></iframe>
          <br></br>
        <script src="https://link.msgsndr.com/js/form_embed.js" type="text/javascript"></script>
      </div>
    );
};

const ChatWindow: React.FC<ChatConfig & { assistant: Assistant; session: SessionOptions }> = ({
  assistant,
  versionID,
  verify,
  user,
  url,
  session,
}) => {
  // emitters
  const close = useCallback(() => sendMessage({ type: PostMessage.Type.CLOSE }), []);
  const saveSession = useCallback((session: SessionOptions) => sendMessage({ type: PostMessage.Type.SAVE_SESSION, payload: session }), []);

  const runtime = useRuntime({ versionID, verify, url, user, session, saveSession }, [verify.projectID]);

  // listeners
  Listeners.useListenMessage(PostMessage.Type.INTERACT, ({ payload }) => runtime.interact(payload));
  Listeners.useListenMessage(PostMessage.Type.OPEN, async (): Promise<void> => {
    if (runtime.isStatus(SessionStatus.IDLE)) {
      await handleStart();
    }
  });

  useEffect(()=>{
    runtime.register({
      canHandle:({type})=>type==='schedule_meeting',
      handle:({context},trace)=>{
        context.messages.push({type:CALENDAR_WIDGET,payload:JSON.parse(trace.payload)['url']} as any);
        return context;
      },
    });
  },[]);

  const handleStart = async (): Promise<void> => {
    await runtime.launch();
  };

  const closeAndEnd = useCallback((): void => {
    runtime.setStatus(SessionStatus.ENDED);
    close();
  }, []);

  const theme = useTheme(assistant);

  const getPreviousUserTurn = useCallback(
    (turnIndex: number): UserTurnProps | null => {
      const turn = runtime.session.turns[turnIndex - 1];
      return turn?.type === TurnType.USER ? turn : null;
    },
    [runtime.session.turns]
  );

  return (
    <RuntimeAPIProvider {...runtime}>
      <ChatWindowContainer className={theme}>
        <Chat
          title={assistant.title}
          description={assistant.description}
          image={assistant.image}
          avatar={assistant.avatar}
          withWatermark={assistant.watermark}
          startTime={runtime.session.startTime}
          hasEnded={runtime.isStatus(SessionStatus.ENDED)}
          isLoading={!runtime.session.turns.length}
          onStart={handleStart}
          onEnd={closeAndEnd}
          onSend={runtime.reply}
          onMinimize={close}
        >
          {runtime.session.turns.map((turn, turnIndex) =>
            match(turn)
              .with({ type: TurnType.USER }, ({ id, ...props }) => <UserResponse {...R.omit(props, ['type'])} key={id} />)
              .with({type:CALENDAR_WIDGET as any},(payload)=>{ return <Calendar_Widget url={payload["payload" as any]} />})
              .with({ type: TurnType.SYSTEM }, ({ id, ...props }) => (
                <SystemResponse
                  key={id}
                  {...R.omit(props, ['type'])}
                  feedback={
                    assistant.feedback
                      ? {
                          onClick: (feedback: FeedbackName) => {
                            runtime.feedback(feedback, props.messages, getPreviousUserTurn(turnIndex));
                          },
                        }
                      : undefined
                  }
                  avatar={assistant.avatar}
                  isLast={turnIndex === runtime.session.turns.length - 1}
                />
              ))
              .exhaustive()
          )}
          {runtime.indicator && <SystemResponse.Indicator avatar={assistant.avatar} />}
        </Chat>
      </ChatWindowContainer>
    </RuntimeAPIProvider>
  );
};

export default Object.assign(ChatWindow, { sendMessage, Container: ChatWindowContainer });
