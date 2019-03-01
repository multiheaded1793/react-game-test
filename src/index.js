'use strict';
// import Proton from './Proton';

const fps = 200;
const animInterval = 1000/fps;
const KEY = {
  LEFT:  37,
  RIGHT: 39,
  UP: 38,
  DOWN: 40,
  A: 65,
  D: 68,
  W: 87,
  S: 83,
  SPACE: 32
};

function objectDistance(b1, b2) {
  return Math.sqrt(Math.pow(b1.x-b2.x, 2) + Math.pow(b1.y-b2.y, 2));;
}

function towardsBody(origin, target) {
  //makes a vector to follow
  let tx = (origin.x - target.x) / objectDistance(origin, target);
  let ty = (origin.y - target.y) / objectDistance(origin, target);
  return { x: tx, y: ty };
}

function getBearing(originX, originY, targetX, targetY) {
  return -Math.atan2(targetY-originY, targetX-originX) *360/(Math.PI*2);
}

function shadeColor(color, rShade, gShade=rShade, bShade=rShade) {

  var R = parseInt(color.substring(1,3),16);
  var G = parseInt(color.substring(3,5),16);
  var B = parseInt(color.substring(5,7),16);

  R = parseInt(R * (100 + rShade) / 100);
  G = parseInt(G * (100 + gShade) / 100);
  B = parseInt(B * (100 + bShade) / 100);

  R = (R<255)?R:255;
  G = (G<255)?G:255;
  B = (B<255)?B:255;

  var RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
  var GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
  var BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));

  return "#"+RR+GG+BB;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // You can also log the error to an error reporting service
    console.log(error, info);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}

//game logic and animation
class OrbitGame extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      screen: {
        width: 700,
        height: 700,
        // dynWidth: window.innerWidth/2,
        // dynHeight: window.innerHeight/2,
        ratio: window.devicePixelRatio || 1,
      },
      world: {
        stage: null,
        bodies: [],
        structures: [],
      },
      params: {
        gravFalloff: 0.9,
        bounceDampening: 0.9,
      },
      ball: {
        x: 100,
        y: 150,
        vx: 0,
        vy: 0.5,
        size: 6,
        mass: 3,
        speed: 0,
        accel: 0,
        thrustAcc: 0.1,
        heading: 0,
        power: 0,
        color: "#E0EDFF",
      },
      resources: {
        matter: 0,
        energy: 0,
        psi: 0,
        hm: 0,
      },
      keys : {
        left  : 0,
        right : 0,
        up    : 0,
        down  : 0,
        space : 0,
      },
      mousedown: false,
      mouseObj: {
        x: 350,
        y: 350
      },
      tick: 0,
      ts: 0,
      magicNumber: 0,
      currentScore: 0,
      inGame: true,
    };
    this.animationID = null;
    this.timerID = null;
    // this.tickCount = 0;
    //need to figure out if anything's worth storing outside the state;
    this.handlePowerChange = this.handlePowerChange.bind(this);
    this.increasePsi = this.increasePsi.bind(this);
    this.handlePauseStart=this.handlePauseStart.bind(this);
    this.handleKeys=this.handleKeys.bind(this);
    this.mouseupHandler = this.mouseupHandler.bind(this);
    this.mousedownHandler = this.mousedownHandler.bind(this);
    this.mousemoveHandler = this.mousemoveHandler.bind(this);

    let createdBodies = this.state.world.bodies;
    const sol = new Body(solData);
    createdBodies.push(sol);
    const mars = new Body(marsData, sol);
    createdBodies.push(mars);
    const venus = new Body(venusData);
    createdBodies.push(venus);
    const earth = new Body(earthData);
    createdBodies.push(earth);
    const phobos = new Body(phobosData, mars);
    createdBodies.push(phobos);

    let createdStructures = this.state.world.structures;
    const s1 = new ringStructure({numSeg: 9, gap: 0.4, radius: 180, speed: 2, origin: {x: 350, y: 350}, width: 8, hue: "#CC7722"})
    s1.addSegments();
    createdStructures.push(s1);
    const s2 = new ringStructure({numSeg: 12, gap: 0.3, radius: 300, speed: 1, origin: {x: 350, y: 350}, width: 14, hue: "#E555E0"})
    s2.addSegments();
    createdStructures.push(s2);

  }

  randomMagicNumber = () => {
    return this.setState({
      magicNumber: _.random(100),
    });
  }

  planetCollision(origin, body) {
    if (objectDistance(origin, body) < body.size + origin.size) {
      //oh hell, setting this dynamically will be a problem
      this.setState((prevState) => {
        return {
          currentScore: prevState.currentScore + 1,
          ball: {
            ...prevState.ball,
            vx: -prevState.ball.vx * prevState.params.bounceDampening,
            vy: -prevState.ball.vy * prevState.params.bounceDampening,
          }
        }
      });
    }
  }

  borderCollision(object) {
    if (object.x+object.vx > this.state.screen.width - object.size || object.x+object.vx < object.size) {
      this.setState((prevState) => {
        return {
          ball: {
            ...prevState.ball,
            vx: -prevState.ball.vx * prevState.params.bounceDampening,
          }
        }
      });
    }
    if (object.y+object.vy > this.state.screen.width - object.size || object.y+object.vy < object.size) {
      this.setState((prevState) => {
        return {
          ball: {
            ...prevState.ball,
            vy: -prevState.ball.vy * prevState.params.bounceDampening,
          }
        }
      });
    }
  }

  gravPull(object, targets) {
    for (let body of targets) {
      let gx = body.mass*towardsBody(object, body).x/Math.pow(objectDistance(object, body) * this.state.params.gravFalloff, 2);
      let gy = body.mass*towardsBody(object, body).y/Math.pow(objectDistance(object, body) * this.state.params.gravFalloff, 2);
      this.setState((prevState) => {
        return {
          ball: {
            ...prevState.ball,
            vx: prevState.ball.vx - gx,
            vy: prevState.ball.vy - gy,
          }
        }
      })
    }
  }

  thrustInput() {
    var tx = 0;
    var ty = 0;
    if (this.state.keys.up) {
      ty -= this.state.ball.thrustAcc;
    }
    if (this.state.keys.down) {
      ty += this.state.ball.thrustAcc;
    }
    if (this.state.keys.left) {
      tx -= this.state.ball.thrustAcc;
    }
    if (this.state.keys.right) {
      tx += this.state.ball.thrustAcc;
    }
    if (tx||ty) {
      this.setState((prevState) => {
        return {
          ball: {
            ...prevState.ball,
            vx: prevState.ball.vx + tx,
            vy: prevState.ball.vy + ty,
          }
        }
      })
    }
  }

  moveBall() {
    const ball = this.state.ball;
    const bodies = this.state.world.bodies
    this.borderCollision(ball)
    this.gravPull(ball, bodies);
    for (let body of bodies) {
      this.planetCollision(ball, body)
    }
    this.thrustInput();
    this.setState((prevState) => {
      return {
        ball: {
          ...prevState.ball,
          x: prevState.ball.x + prevState.ball.vx,
          y: prevState.ball.y + prevState.ball.vy,
        }
      }
    })
  }

  handlePowerChange() {
    this.setState((prevState) => {
      return {
        currentScore: 0,
        resources: {
          ...prevState.resources,
          energy: prevState.resources.energy + prevState.currentScore*10,
        }
      }
    });
  }

  increasePsi() {
    this.setState((prevState) => {
      return {
        resources: {
          ...prevState.resources,
          psi: prevState.resources.psi+1,
        }
      }
    });
  }

  handleKeys(value, e) {
    let keys = this.state.keys;
    if(e.keyCode === KEY.LEFT   || e.keyCode === KEY.A) { keys.left  = value }
    if(e.keyCode === KEY.DOWN   || e.keyCode === KEY.S) { keys.down  = value }
    if(e.keyCode === KEY.RIGHT  || e.keyCode === KEY.D) { keys.right = value }
    if(e.keyCode === KEY.UP     || e.keyCode === KEY.W) { keys.up    = value }
    if(e.keyCode === KEY.SPACE) keys.space = value;
    this.setState((prevState) => {
      return {
        keys: keys,
      }
    });
  }

  mousedownHandler(e) {
    this.setState((prevState) => {
      return {
        mousedown: true,
      }
    });
    this.mousemoveHandler(e);
  }

  mouseupHandler(e) {
    this.setState((prevState) => {
      return {
        mousedown: false,
      }
    });
  }

  mousemoveHandler(e) {
    if (this.state.mousedown) {
      // console.log(e)
      // if (e.layerX || e.layerX == 0) {
      //   _x = e.layerX;
      //   _y = e.layerY;
      // } else if (e.offsetX || e.offsetX == 0) {
      //   _x = e.offsetX;
      //   _y = e.offsetY;
      // }
      var _x = e.clientX - e.currentTarget.getBoundingClientRect().x;
      var _y = e.clientY - e.currentTarget.getBoundingClientRect().y;
      // console.log(_x, _y)
      this.setState((prevState) => {
        return {
          mouseObj: {
            x: _x,
            y: _y,
          },
        }
      });
    }
  }

  handlePauseStart() {
    if (this.state.inGame == false) {
      this.continueGame();
      console.log("continue");
    } else {
      this.stopGame();
      console.log("pause");
    }
  }

  continueGame() {
    // this.timerID = setInterval(
    //   () => this.randomMagicNumber(),
    //   500
    // );
    requestAnimationFrame((t) => {this.update(t)});
    this.setState({
      inGame: true,
    });
  }

  stopGame() {
    clearInterval(this.timerID);
    cancelAnimationFrame(this.animationID);
    this.setState({
      inGame: false,
    })
  }

  componentDidMount() {
    window.addEventListener('keyup',   this.handleKeys.bind(this, false));
    window.addEventListener('keydown', this.handleKeys.bind(this, true));
    // window.addEventListener('resize',  this.handleResize.bind(this, false));

    this.continueGame();
  }

  componentWillUnMount() {
    clearInterval(this.timerID);
    cancelAnimationFrame(this.animationID);
  }

  update(t) {
    const bodies = this.state.world.bodies;
    const structures = this.state.world.structures;
    //fps
    let delta = t - this.state.ts;
    if (delta > animInterval) {
      this.setState((prevState) => {
        return {
          ts: t - (delta % animInterval),
          tick: prevState.tick + 1,
        }
      });
      if (this.state.mousedown && this.state.resources.energy > 0) {
        for (let planet of bodies) {
          planet.getsPulled(10, this.state.mouseObj)
        }
        this.setState((prevState) => {
          return {
            resources: {
              ...prevState.resources,
              energy: prevState.resources.energy-1,
            }
          }
        })
      }
      for (let planet of bodies) {
        planet.orbit ? planet.movePlanet() : null;
      }
      for (let layer of structures) {
        layer.moveSegments();
      }
      this.moveBall();
    }

    if (this.state.tick < 100000 && this.state.inGame) {
      this.animationID = requestAnimationFrame((t) => {this.update(t)});
    }
  }

  render() {
    const pause = this.state.inGame ?
    <Button onClick={this.handlePauseStart} style={{ backgroundColor: 'red' }} text="Pause" /> :
    <Button onClick={this.handlePauseStart} text="Continue" />;
    const sparklebutton = <Button onClick={this.increasePsi} style={{ backgroundColor: '#4666FF' }} text={`Psi blasts: ${this.state.resources.psi}`} />;
    const pullbutton = <Button onClick={this.handlePowerChange} style={{ backgroundColor: '#E0115F' }} text={`Energy: ${this.state.resources.energy} (click to charge)`} />;
    const interfaceState = {
      tick: this.state.tick,
      ts: this.state.ts,
      inGame: this.state.inGame,
      currentScore: this.state.currentScore,
      ball: {
        ...this.state.ball,
      },
      resources: {
        ...this.state.resources,
      }
    }
    const readyCanvas = this.state.world.bodies.length > 0 ?
    <GameCanvas onMouseDown={this.mousedownHandler} onMouseUp={this.mouseupHandler} onMouseMove={this.mousemoveHandler} {...this.state} /> :
    null;
    return (
      <div>
      <ErrorBoundary>
      {readyCanvas}
      <UI {...interfaceState}>
      {pause}{sparklebutton}{pullbutton}
      </UI>
      </ErrorBoundary>
      </div>
    );
  }
};



//game logic
class ringStructure {
  constructor({numSeg=5, arg=0, gap=0.4, radius=240, speed=5, origin={x: 350, y: 350}, width=10, hue="#E0E0E0"}={}) {
    this.numSeg = numSeg;
    this.arg = arg;
    this.gap = gap;
    this.radius = radius;
    this.speed = speed;
    this.origin = origin;
    this.width = width;
    this.hue = hue;
    this.segments = [];
  }

  // addSegments({numSeg, arg, gap, r, origin, width, hue}={})
  addSegments() {
    let arg = this.arg;
    let gap = this.gap;
    let numSeg = this.numSeg;
    let r = this.radius;
    let origin = this.origin;
    let width = this.width;
    let hue = this.hue;
    for (let i=0;i<numSeg;i++) {
      let segment = {
        a: arg,
        b: arg + (Math.PI*2*(1-gap))/numSeg,
        r: r,
        origin: origin,
        width: width,
        hue: hue,
        health: 3,
      };
      this.segments.push(segment);
      arg += (Math.PI*2)/numSeg;
    }
  }

  destroySegment(seg) {
    const destroy = this.segments.filter(item => item !== seg);
  }

  moveSegments() {
    for (let seg of this.segments) {
      seg.a += Math.PI*2*0.001*this.speed;
      seg.b += Math.PI*2*0.001*this.speed;
    }
  }
}

class Body {
  constructor(data, parent=null) {
    this.data = data;
    this.xPar = data.xPar||350;
    this.yPar = data.yPar||350;
    if (this.parent) {
      this.xPar = this.parent.x
      this.yPar = this.parent.y
    }
    this.size = data.size||15;
    this.orbit = data.orbit||0;
    this.speed = data.speed||0;
    this.mass = data.mass||0;
    this.hue = data.hue||"#FFFF00";
    this.name = data.name||"Unknown";
    this.angle = data.angle||0;
    this.parent = parent;
    this.x = this.xPar + this.orbit;
    this.y = this.yPar + this.orbit;
    this.vx = 0;
    this.vy = 0;
    this.dx = 0;
    this.dy = 0;
    console.log("creating body: "+this.name);
  }

  getsPulled(force, target) {
    if (objectDistance(this, target) > this.size*1.5)  {
    this.dx -= force*towardsBody(this, target).x/Math.pow(objectDistance(this, target) * 0.05, 1.25);
    this.dy -= force*towardsBody(this, target).y/Math.pow(objectDistance(this, target) * 0.05, 1.25);
    }
    // console.log(this.vx)
  }

  // Adding a method to the constructor
  movePlanet() {
    this.angle += Math.acos(1 - Math.pow(this.speed / this.orbit, 2) / 2);
    if (this.parent) {
      this.xPar = this.parent.x
      this.yPar = this.parent.y
    }
    // if (this.vx) {
    //   this.dx += this.vx;
    //   this.vx = 0;
    // }
    // if (this.vy) {
    //   this.dy += this.vy;
    //   this.vy = 0;
    // }
    this.x = this.xPar + this.orbit * Math.cos(this.angle) + this.dx;
    this.y = this.yPar + this.orbit * Math.sin(this.angle) + this.dy;

    if (this.dx) {
      this.dx = Math.floor(this.dx*0.9)
    }
    if (this.dy) {
      this.dy = Math.floor(this.dy*0.99)
    }

  };
}

const marsData = {
  size: 10,
  orbit: 230,
  speed: 2,
  mass: 110,
  hue: "#ff4336",
  angle: 30,
  name: "Mars",
}

const phobosData = {
  size: 8,
  orbit: 50,
  speed: 1.5,
  mass: 50,
  hue: "#EE1111",
  angle: 30,
  name: "#Phobos",
}

const venusData = {
  xPar: 330,
  yPar: 340,
  size: 15,
  orbit: 100,
  speed: 1,
  mass: 170,
  hue: "#449932",
  angle: 0,
  name: "Venus",
}

const earthData = {
  xPar: 350,
  yPar: 350,
  size: 12,
  orbit: 160,
  speed: 1,
  mass: 150,
  hue: "#007FFF",
  angle: 120,
  name: "Earth",
}

const solData = {
  xPar: 350,
  yPar: 350,
  size: 20,
  orbit: 0,
  speed: 0,
  mass: 220,
  hue: "#ffee36",
  angle: 0,
  name: "Sol",
}

//interface here
const UI = ({ tick, ts, inGame, currentScore, ball, children, resources }) => (
  <div>
  {children}
  <span>{"Energy: "+resources.energy}</span>
  </div>
);

const Button = ({ onClick, text, style }) => (
  <button onClick={onClick} type="button" style={style}>
  {text}
  </button>
);


//drawing the myCanvas in two stages, idea by Phil Nash https://philna.sh/, elements from Reacteroids
class GameCanvas extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      zones: [],
    }
    this.saveContext = this.saveContext.bind(this);
    // this.mouseupHandler = this.mouseupHandler.bind(this);
    // this.mousedownHandler = this.mousedownHandler.bind(this);
    // this.mousemoveHandler = this.mousemoveHandler.bind(this);
    this.mouseTick = 0;
    this.mousedownevent = false;
    //proton
    this.attractionBehaviours = [];
    this.tick = 1;
    this.psiLevel = 0;
    this.emitterList = [];
  }

  saveContext(canvas) {
    this.protonCanvas = canvas;
    console.log(this);
    this.ctx = canvas.getContext('2d');
    this.width = this.ctx.canvas.width;
    this.height = this.ctx.canvas.height;
  }

  componentDidMount() {
    //proton
    this.initProton();
  }

  initProton() {
    // this.conf = { radius: 170, tha: 0 };
    // this.mouseObj = {
    //   x: this.protonCanvas.width / 2,
    //   y: this.protonCanvas.height / 2
    // };
    // this.mousedown = false;
    // this.protonCanvas.addEventListener('mousedown', this.mousedownHandler, false);
    // this.protonCanvas.addEventListener('mouseup', this.mouseupHandler, false);
    // this.protonCanvas.addEventListener('mousemove', this.mousemoveHandler, false);
    this.createProton();
    console.log(this.props);
  }

  createProton() {
    this.proton = new Proton;
    const pr = this.ctx;
    // const imageWidth = 342;
    // const drawScopeWidth = 710;
    // const rect = new Proton.Rectangle((this.protonCanvas.width - imageWidth) / 2, (this.protonCanvas.height - imageWidth) / 2, imageWidth, imageWidth);
    // const rect2 = new Proton.Rectangle((this.protonCanvas.width - drawScopeWidth) / 2, 0, drawScopeWidth, this.protonCanvas.height);
    // const rectZone = new Proton.RectZone(rect2.x, rect2.y, rect2.width, rect2.height);
    // const zones = this.state.zones;
    // this.emitterList[0].addBehaviour(this.customToZoneBehaviour(zones[0], zones[1], zones[2]));
    this.crossZoneBehaviour = new Proton.CrossZone(new Proton.RectZone(0, 0, this.protonCanvas.width, this.protonCanvas.height), 'bound');
    this.randomBehaviour = new Proton.RandomDrift(5, 5, .05);
    // const gravityBehaviour = new Proton.Gravity(0);
    // const gravityWellBehaviour = new Proton.GravityWell({
    //   x: this.protonCanvas.width / 2,
    //   y: this.protonCanvas.height / 2
    // }, 0, 0);

    this.emitterList.push(this.createImageEmitter(this.protonCanvas.width / 4, this.protonCanvas.height / 4, '#DD4400', '#EEEEEE', 5, 4, this.props.world.bodies[4], 60, 90));
    this.emitterList.push(this.createImageEmitter(this.protonCanvas.width / 3, this.protonCanvas.height / 3, '#EE3355', '#0029CC', 8, 5, this.props.world.bodies[1]));
    this.emitterList.push(this.createImageEmitter(this.protonCanvas.width / 2, this.protonCanvas.height / 2, '#EEBB35', '#EEBB35', 6, 6, this.props.world.bodies[2]));
    this.emitterList.push(this.createImageEmitter(this.protonCanvas.width / 4, this.protonCanvas.height / 4, '#2292FF', '#2292FF', 5, 5, this.props.world.bodies[3], 80, 120));

    this.psiEmitter = this.createImageEmitter(this.props.ball.x, this.props.ball.y, '#FF4433', '#FFDDFF', 8, 10, this.props.ball, 40, 60, 0.01, 'once', (1,5));
    this.clickEmitter = this.createPointEmitter('#CC58F5', '#FD1212', this.props.ball);
    this.renderer = new Proton.CanvasRenderer(this.protonCanvas);

    // this.renderer.onProtonUpdate = function() {
    //   pr.fillStyle = "rgba(0, 0, 0, 0.02)";
    //   pr.fillRect(0, 0, protonCanvas.width, protonCanvas.height);
    // };
    this.renderer.onParticleUpdate = (particle) => {
      pr.beginPath();
      pr.globalAlpha = 0.9
      pr.strokeStyle = particle.color;
      pr.lineWidth = particle.radius/5;
      pr.moveTo(particle.old.p.x, particle.old.p.y);
      pr.lineTo(particle.p.x, particle.p.y);
      pr.closePath();
      pr.stroke();
      pr.globalAlpha = 1
    };
    this.proton.addRenderer(this.renderer);
  }

  // setZones(img) {
  //   let zones = this.state.zones;
  //   for (let i of img) {
  //     let imagedata = Proton.Util.getImageData(this.ctx, i, rect)
  //     zones.push(new Proton.ImageZone(imagedata, rect.x, rect.y))
  //     }
  //   this.setState((prevState) => {
  //     return {
  //       zones: zones,
  //     }
  //   });
  // }

  // customToZoneBehaviour(zone1, zone2, zone3) {
  //   return {
  //     initialize: function(particle) {
  //       particle.R = Math.random() * 10;
  //       particle.Angle = Math.random() * Math.PI * 2;
  //       particle.speed = Math.random() * (-1.5) + 0.75;
  //       particle.zones = [zone1.getPosition().clone(), zone2.getPosition().clone(), zone3.getPosition().clone()];
  //     },
  //
  //     applyBehaviour: function(particle) {
  //       if (mouseTick % 2 != 0) {
  //         particle.v.clear();
  //         particle.Angle += particle.speed;
  //         let index = (mouseTick % 6 + 1) / 2 - 1;
  //         let x = particle.zones[index].x + particle.R * Math.cos(particle.Angle);
  //         let y = particle.zones[index].y + particle.R * Math.sin(particle.Angle);
  //         particle.p.x += (x - particle.p.x) * 0.05;
  //         particle.p.y += (y - particle.p.y) * 0.05;
  //       }
  //     }
  //   }
  // }

  createImageEmitter(x, y, color1=null, color2=null, mass=5, radius=5, target=null, rate1=100, rate2=200, damp=0.005, em='once', life=null) {
    var emitter = new Proton.Emitter();
    emitter.target = target;
    // console.log(target);
    emitter.damping = damp;
    emitter.rate = new Proton.Rate(new Proton.Span(rate1, rate2));
    // emitter.rate = new Proton.Rate(new Proton.Span(50, 80), new Proton.Span(.1, .5));
    emitter.addInitialize(new Proton.Mass(mass));
    emitter.addInitialize(new Proton.Radius(radius));
    if (life) {
      emitter.addInitialize(new Proton.Life(life));
    }
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(2,4), new Proton.Span(0, 360), 'polar'));
    emitter.addBehaviour(this.randomBehaviour);
    color1 && color2 ?
    emitter.addBehaviour(new Proton.Color(color1, color2)) :
    emitter.addBehaviour(new Proton.Color('random'));
    // emitter.addBehaviour(new Proton.Scale(3.5, 0.5));
    emitter.addBehaviour(this.crossZoneBehaviour);
    var mouseAttract = new Proton.Attraction(this.mouseObj, 5, 200);
    emitter.addBehaviour(mouseAttract);
    this.attractionBehaviours.push(mouseAttract);
    if (target) {
      emitter.planetAttraction = new Proton.Attraction(target, 15, 500);
      emitter.addBehaviour(emitter.planetAttraction);
    };
    emitter.p.x = x;
    emitter.p.y = y;
    emitter.emit(em);
    this.proton.addEmitter(emitter);
    console.log(emitter);
    return emitter;
  }

  createPointEmitter(color1, color2, target=null) {
    var emitter = new Proton.Emitter();
    var emitDirection = getBearing(target.x+target.vx,target.y+target.vy,target.x,target.y);
    emitter.emitDirection = emitDirection;
    emitter.target = target;
    emitter.damping = 0.015;
    emitter.rate = new Proton.Rate(new Proton.Span(20, 80), .3);
    emitter.addInitialize(new Proton.Mass(4));
    emitter.addInitialize(new Proton.Life(new Proton.Span(3,5)))
    emitter.addInitialize(new Proton.Radius(15));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(3,5), new Proton.Span(emitDirection-15, emitDirection+15), 'polar'));
    // if (target.vx && target.vy) {
    //   emitter.addInitialize(new Proton.Force(target.vx*120, target.vy*120))
    // }
    emitter.addBehaviour(this.randomBehaviour);
    emitter.addBehaviour(new Proton.Color(color1, color2));
    emitter.addBehaviour(this.crossZoneBehaviour);
    emitter.pointAttraction = new Proton.Attraction(target, 10, 400);
    emitter.addBehaviour(emitter.pointAttraction);
    emitter.p.x = target.x;
    emitter.p.y = target.y;
    emitter.emit('once');
    this.proton.addEmitter(emitter);
    return emitter;
  }

  // mousedownHandler(e) {
  //   this.mousedown = true;
  //   this.mousemoveHandler(e);
  //

  // }
  //
  // mouseupHandler(e) {
  //   this.mousedown = false;
  //   for (let a of this.attractionBehaviours) {
  //     a.reset(this.mouseObj, 5, 200);
  //   }
  // }
  //
  // mousemoveHandler(e) {
  //   if (this.mousedown) {
  //     var _x, _y;
  //     if (e.layerX || e.layerX == 0) {
  //       _x = e.layerX;
  //       _y = e.layerY;
  //     } else if (e.offsetX || e.offsetX == 0) {
  //       _x = e.offsetX;
  //       _y = e.offsetY;
  //     }
  //     this.mouseObj.x = _x;
  //     this.mouseObj.y = _y;
  //   }
  // }

  componentDidUpdate() {
    const bodies = this.props.world.bodies;
    if (this.props.tick > this.tick) {
      // this.ctx.save();
      // this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      // this.ctx.fillRect(0, 0, this.width, this.height);
      this.updateWorld();
      this.proton.update();
      if (this.psiLevel < this.props.resources.psi && this.psiEmitter) {
        this.psiLevel++;
        this.psiEmitter.rate = this.psiLevel < 9 ?
        new Proton.Rate(new Proton.Span(20+this.psiLevel*8, 25+this.psiLevel*12), this.psiLevel*0.25) :
        new Proton.Rate(new Proton.Span(150, 180), 4)
        this.psiEmitter.emit('once')
      }
      this.drawStructures();
      for (let planet of bodies) {
        this.drawConnect(planet, this.props.ball);
        this.drawPlanet(planet);
      }
      this.drawBall();
      // this.drawLayer(7, (Math.PI*2)*0.008*this.tick, 0.3, 240);
      // this.drawLayer(9, (Math.PI*2)*0.003*this.tick, 0.3, 270);
      // this.drawLayer(5, (Math.PI*2)*0.005*this.tick, 0.4, 125);
      this.drawScore();
      // this.ctx.restore();
      this.mouseInput()
      this.tick = this.props.tick;
    }
  }

  mouseInput() {
    if (this.props.mousedown == true) {
      if (this.mouseTick % 40 == 0) {
        this.clickEmitter.emit('once');
      }
      if (this.mousedownevent == false) {
        for (let a of this.attractionBehaviours) {
          a.reset(this.props.mouseObj, 25, 600);
        }
      }
      this.mouseTick++;
      this.mousedownevent = true;
    } else {
      if (this.mousedownevent == true) {
        for (let a of this.attractionBehaviours) {
          a.reset(this.props.mouseObj, 5, 200);
        }
      }
      this.mouseTick = 0;
      this.mousedownevent = false;
    }
  }

  updateWorld() {
    this.updateEmitters();
  }

  updateEmitters(x) {
    const bodies = this.props.world.bodies;
    for (let em of this.emitterList) {
      em.planetAttraction.reset(em.target, 20, 500);
    }
    if (this.psiEmitter) {
      this.psiEmitter.p.x = this.props.ball.x;
      this.psiEmitter.p.y = this.props.ball.y;
      this.psiEmitter.planetAttraction.reset(bodies[0], 25, 700)
    }
    if (this.clickEmitter) {
      this.clickEmitter.p.x = this.props.ball.x;
      this.clickEmitter.p.y = this.props.ball.y;
      this.clickEmitter.pointAttraction.reset(this.props.ball, 10, 500)
    }
  }

  // drawSquare() {
  //   const angle = this.props.magicNumber;
  //   this.ctx.beginPath();
  //   this.ctx.translate(this.width / 2, this.height / 2);
  //   this.ctx.rotate((angle * Math.PI) / 180);
  //   this.ctx.fillStyle = '#4397AC';
  //   this.ctx.fillRect(
  //     -this.width / 4,
  //     -this.height / 4,
  //     this.width / 2,
  //     this.height / 2
  //   );
  // }

  drawConnect(origin, target) {
    this.ctx.beginPath();
    this.ctx.globalAlpha = 0.5
    this.ctx.strokeStyle = '#4397DC';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([40, 15]);
    this.ctx.lineDashOffset = 20
    this.ctx.moveTo(origin.x, origin.y);
    this.ctx.lineTo(target.x, target.y);
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.setLineDash([])
    this.ctx.globalAlpha = 1
  }

  drawScore() {
    const score = this.props.currentScore;
    this.ctx.fillStyle = "#F5F5F5";
    this.ctx.font = "22px Arial";
    this.ctx.fillText("x" + score, 10, 25);
  }

  drawBall(blur=1) {
    const ball = this.props.ball;
    const {x, y, vx, vy, size, color} = ball;
    if (blur) {
      this.ctx.beginPath();
      this.ctx.globalAlpha = 0.3;
      this.ctx.arc(x-(vx*blur), y-(vy*blur), size, 0, Math.PI * 2);
      this.ctx.fillStyle = color;
      this.ctx.fill();
      this.ctx.closePath();
      this.ctx.globalAlpha = 1;
    }
    this.ctx.beginPath();
    this.ctx.arc(x, y, size, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.closePath();
  }

  drawPlanet(p) {
    //outlines the orbit
    this.ctx.beginPath();
    this.ctx.arc(p.xPar, p.yPar, p.orbit, 0, Math.PI * 2, false);
    this.ctx.lineWidth = 2;
    this.ctx.globalAlpha = 0.4;
    this.ctx.strokeStyle = "#E0E0E0";
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.globalAlpha = 1;
    //the planet itself
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    // this.ctx.fillStyle = "#"+p.hue;
    this.ctx.fillStyle = p.hue;
    this.ctx.fill();
    this.ctx.closePath();
  };

  // drawLayer(s, a, gap, r) {
  //   let seg = s;
  //   let ast = a;
  //   for (var i=0;i<seg;i++) {
  //     this.drawSegment(seg, ast, gap, r);
  //     ast += (Math.PI*2)
  //   }
  // }
  //
  // drawSegment(seg, ast, gap, r) {
  //   this.ctx.beginPath();
  //   this.ctx.arc(this.width/2, this.height/2, r, ast/seg, (((Math.PI*2)*(1-gap))/seg)+ast/seg, false);
  //   this.ctx.lineWidth = 10;
  //   this.ctx.strokeStyle = "#E0E0E0";
  //   this.ctx.stroke();
  //   this.ctx.closePath();
  // };

  drawStructures() {
    const structures = this.props.world.structures;
    for (let layer of structures) {
      for (let seg of layer.segments) {
        this.drawSegment(seg);
      }
    }
  }

  drawSegment(seg) {
    this.ctx.beginPath();
    this.ctx.arc(seg.origin.x, seg.origin.y, seg.r, seg.a, seg.b, false);
    this.ctx.lineWidth = seg.width;
    this.ctx.strokeStyle = seg.hue;
    this.ctx.stroke();
    this.ctx.closePath();
  }

  render() {
    return (
      <PureCanvas width={this.props.screen.width} height={this.props.screen.height} contextRef={this.saveContext} onMouseDown={this.props.onMouseDown} onMouseUp={this.props.onMouseUp} onMouseMove={this.props.onMouseMove}/>
    )
  }
}

class PureCanvas extends React.Component {
  shouldComponentUpdate() {
    return false;
  }
  render() {
    return (
      <canvas id="myCanvas"
      width={this.props.width}
      height={this.props.height}
      ref={node =>
        node ? this.props.contextRef(node) : null
      } onMouseDown={this.props.onMouseDown} onMouseUp={this.props.onMouseUp} onMouseMove={this.props.onMouseMove} style={{ background: "#36454F" }}
      />
    );
  }
}



const domContainer = document.querySelector('#game-wrapper');
// ReactDOM.render(e(OrbitGame), domContainer);
ReactDOM.render(<OrbitGame testProp="yes" />, domContainer);
