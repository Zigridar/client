const WindowsBalloon = require('node-notifier').WindowsBalloon;

const notifier = new WindowsBalloon({ withFallback: false })

notifier.notify(
  {
    title: 'Windows 10',
    message: 'Updates are available',
    sound: false,
    time: 5000,
    wait: true,
    type: 'info'
  },
  function(error, response) {
    console.log(response);
  }
)