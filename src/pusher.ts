import Pusher from 'pusher-js';

const pusher = new Pusher('29c35ef427eb2795dc5c', {
  cluster: 'us2',
});

export default pusher;
