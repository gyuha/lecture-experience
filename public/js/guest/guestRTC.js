/* eslint-disable import/extensions */
/* eslint-disable no-param-reassign */
/* eslint-disable no-undef */
import { getJanusUrl, addStream, getStatusColor } from '../utility.js';

export const changeStatus = {
  host_disconnected: () => {
    $('video#whiteboard').parent().addClass('running');
    $('video#whiteboard').replaceWith('<video class="whiteboard" id="whiteboard" playsinline autoplay muted ></video>');
    $('#lecture-status .status-dot').css('background', getStatusColor('host_disconnected'));
    $('#lecture-status .status-text').html($('#status-host-disconnected').val());
  },
  live: () => {
    $('#lecture-status .status-dot').css('background', getStatusColor('live'));
    $('#lecture-status .status-text').html($('#status-live').val());
    $('video#whiteboard').parent().removeClass('running');
  },
  connection_lost: () => {
    $('video#whiteboard').parent().addClass('running');
    $('video#whiteboard').replaceWith('<video class="whiteboard" id="whiteboard" playsinline autoplay muted ></video>');
    $('#lecture-status .status-dot').css('background', getStatusColor('connection_lost'));
    $('#lecture-status .status-text').html($('#status-connection-lost').val());
  },
};

export default function initializeGuestRTC(roomId) {
  const janusUrl = getJanusUrl();
  let janus;
  let handle;

  function joinFeed(publishers) {
    if (publishers.length === 0) {
      setTimeout(changeStatus.host_disconnected, 500);
    } else {
      publishers.forEach((publisher) => {
        let remoteHandle;
        janus.attach({
          plugin: 'janus.plugin.videoroom',
          success(remHandle) {
            remoteHandle = remHandle;
            remoteHandle.send({
              message: {
                request: 'join', ptype: 'subscriber', room: roomId, feed: publisher.id,
              },
            });
          },
          onmessage(msg, offerJsep) {
            const event = msg.videoroom;
            if (event === 'attached') {
              remoteHandle.rfid = msg.id;
              remoteHandle.rfdisplay = msg.display;
            }
            if (offerJsep) {
              remoteHandle.createAnswer({
                jsep: offerJsep,
                media: {
                  audioSend: false, videoSend: false,
                },
                success(answerJsep) {
                  remoteHandle.send({ message: { request: 'start', room: roomId }, jsep: answerJsep });
                },
              });
            }
          },
          onremotestream(stream) {
            const webcam = document.getElementById('webcam');
            const whiteboard = document.getElementById('whiteboard');
            const speaker = document.getElementById('speaker');
            const videoTrack = stream.getVideoTracks()[0];
            if (stream.getTracks().length === 2) {
              if (webcam !== null) {
                addStream(webcam, videoTrack);
              } else {
                addStream(whiteboard, videoTrack);
              }
              const audioTrack = stream.getAudioTracks()[0];
              addStream(speaker, audioTrack);
            } else {
              addStream(whiteboard, videoTrack);
            }
            setTimeout(changeStatus.live, 500);
          },
        });
      });
    }
  }

  Janus.init({
    callback() {
      janus = new Janus(
        {
          debug: 'all',
          server: janusUrl,
          success() {
            janus.attach(
              {
                plugin: 'janus.plugin.videoroom',
                success(pluginHandle) {
                  handle = pluginHandle;
                  handle.send({
                    message: {
                      request: 'join', ptype: 'publisher', room: roomId,
                    },
                  });
                },
                onmessage(msg) {
                  const status = msg.videoroom;
                  switch (status) {
                    case 'joined':
                      joinFeed(msg.publishers);
                      break;
                    case 'event':
                      if (typeof msg.unpublished !== 'undefined' || typeof msg.leaving !== 'undefined') {
                        // Handle here properly when the manager disconnects
                      } else if (typeof msg.publishers !== 'undefined') {
                        joinFeed(msg.publishers);
                      }
                      break;
                    default: break;
                  }
                },
              },
            );
          },
        },
      );
    },
  });
}
