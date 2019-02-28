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

function getBearing(originX, originY, targetX, targetY) {
  return -Math.atan2(targetY-originY, targetX-originX) *360/(Math.PI*2);
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
        width: 600,
        height: 600,
        // dynWidth: window.innerWidth/2,
        // dynHeight: window.innerHeight/2,
        ratio: window.devicePixelRatio || 1,
      },
      world: {
        stage: null,
        bodies: [],
      },
      params: {
        gravFalloff: 1,
        bounceDampening: 0.9,
      },
      ball: {
        x: 200,
        y: 200,
        vx: 0,
        vy: 0,
        size: 6,
        mass: 3,
        speed: 0,
        accel: 0,
        thrustAcc: 0.2,
        heading: 0,
        power: 0,
        color: "#F68F5B",
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
      tick: 0,
      ts: 0,
      magicNumber: 0,
      currentScore: 0,
      topScore: localStorage['topscore'] || 0,
      inGame: true,
    };
    this.animationID = null;
    this.timerID = null;
    // this.tickCount = 0;
    //some things must be stored outside the state??
    this.handlePowerChange = this.handlePowerChange.bind(this);
    this.increasePsi = this.increasePsi.bind(this);
    this.handlePauseStart=this.handlePauseStart.bind(this);
    this.handleKeys=this.handleKeys.bind(this);

    let createdBodies = this.state.world.bodies;
    const sol = new Body(solData);
    createdBodies.push(sol)
    const mars = new Body(marsData, sol);
    createdBodies.push(mars)
    const venus = new Body(venusData);
    createdBodies.push(venus)
    const phobos = new Body(phobosData, mars);
    createdBodies.push(phobos)
  }

  randomMagicNumber = () => {
    return this.setState({
      magicNumber: _.random(100),
    });
  }

  objectDistance(b1, b2) {
    return Math.sqrt(Math.pow(b1.x-b2.x, 2) + Math.pow(b1.y-b2.y, 2));;
  }

  towardsBody(origin, target) {
    //makes a vector to follow
    let tx = (origin.x - target.x) / this.objectDistance(origin, target);
    let ty = (origin.y - target.y) / this.objectDistance(origin, target);
    return { x: tx, y: ty };
  }

  planetCollision(origin, body) {
    if (this.objectDistance(origin, body) < body.size + origin.size) {
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
    // var gx, gy;
    for (let body of targets) {
      let gx = body.mass*this.towardsBody(object, body).x/Math.pow(this.objectDistance(object, body) * this.state.params.gravFalloff, 2);
      let gy = body.mass*this.towardsBody(object, body).y/Math.pow(this.objectDistance(object, body) * this.state.params.gravFalloff, 2);
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

  handlePowerChange(power) {
    this.setState((prevState) => {
      return {

      }
    });
  }

  increasePsi() {
    this.setState((prevState) => {
      return {
        resources: {
          ...prevState.resources,
          psi: prevState.resources.psi+1,
        }}
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
      const bodies = this.state.world.bodies
      //fps
      let delta = t - this.state.ts;
      if (delta > animInterval) {
        this.setState((prevState) => {
          return {
            ts: t - (delta % animInterval),
            tick: prevState.tick + 1,
          }
        })
        for (let planet of bodies) {
          planet.orbit ? planet.movePlanet() : null;
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
      const more = <Button onClick={this.increasePsi} style={{ backgroundColor: 'blue' }} text={`Psi charge: ${this.state.resources.psi}`} />;
      const gameState = {
        tick: this.state.tick,
        ts: this.state.ts,
        inGame: this.state.inGame,
        currentScore: this.state.currentScore,
        ball: {
          ...this.state.ball,
        },
      }
      const readyCanvas = this.state.world.bodies.length > 0 ?
      <GameCanvas {...this.state} /> :
      null;
      return (
        <div>
        <ErrorBoundary>
        {readyCanvas}
        <UI {...gameState}>
        {pause}{more}
        </UI>
        </ErrorBoundary>
        </div>
      );
    }
  };



  //game logic
  class Body {
    constructor(data, parent=null) {
      this.data = data;
      this.xPar = data.xPar||300;
      this.yPar = data.yPar||300;
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
      console.log("creating body: "+this.name);
    }

    // Adding a method to the constructor
    movePlanet() {
      this.angle += Math.acos(1 - Math.pow(this.speed / this.orbit, 2) / 2);
      if (this.parent) {
        this.xPar = this.parent.x
        this.yPar = this.parent.y
      }
      this.x = this.xPar + this.orbit * Math.cos(this.angle);
      this.y = this.yPar + this.orbit * Math.sin(this.angle);
    };
  }

  const marsData = {
    size: 12,
    orbit: 100,
    speed: 2,
    mass: 80,
    hue: "#ff4336",
    angle: 30,
    name: "Mars",
  }

  const phobosData = {
    size: 8,
    orbit: 50,
    speed: 1,
    mass: 50,
    hue: "#EE1111",
    angle: 30,
    name: "#Phobos",
  }

  const venusData = {
    xPar: 320,
    yPar: 340,
    size: 16,
    orbit: 200,
    speed: 1,
    mass: 180,
    hue: "#66CC32",
    angle: 60,
    name: "Venus",
  }

  const solData = {
    xPar: 300,
    yPar: 300,
    size: 25,
    orbit: 0,
    speed: 0,
    mass: 250,
    hue: "#ffee36",
    angle: 0,
    name: "Sol",
  }

  //interface here
  const UI = ({ tick, ts, inGame, currentScore, ball, children }) => (
    <div>
    {children}
    <span>{tick +" "+ (ts/100).toFixed(2)}</span>
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
      this.saveContext = this.saveContext.bind(this);
      this.mouseupHandler = this.mouseupHandler.bind(this);
      this.mousedownHandler = this.mousedownHandler.bind(this);
      this.mousemoveHandler = this.mousemoveHandler.bind(this);
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

    createProton() {
      this.proton = new Proton;
      // this.emitterList.push(this.createImageEmitter(this.protonCanvas.width / 4, this.protonCanvas.height / 4, '#DD4400', '#EEEEEE', 5, 4, this.props.world.bodies[0]));
      this.emitterList.push(this.createImageEmitter(this.protonCanvas.width / 3, this.protonCanvas.height / 3, '#EE3355', '#0029CC', 8, 5, this.props.world.bodies[1]));
      this.emitterList.push(this.createImageEmitter(this.protonCanvas.width / 2, this.protonCanvas.height / 2, '#EECC53', '#EECC53', 6, 6, this.props.world.bodies[2]));
      this.emitterList.push(this.createImageEmitter(this.protonCanvas.width / 4, this.protonCanvas.height / 4, '#2292FF', '#2292FF', 5, 5, this.props.world.bodies[3], 80, 120));
      this.psiEmitter = this.createImageEmitter(this.props.ball.x, this.props.ball.y, '#FFDDFF', '#FFDDFF', 8, 10, this.props.ball, 40, 60, 0.01, 'once', (1,5));
      this.clickEmitter = this.createPointEmitter('#9999FF', '#9999FF', this.props.ball);
      this.renderer = new Proton.CanvasRenderer(this.protonCanvas);
      // this.renderer.onProtonUpdate = function() {
      //   pr.fillStyle = "rgba(0, 0, 0, 0.02)";
      //   pr.fillRect(0, 0, protonCanvas.width, protonCanvas.height);
      // };
      const pr = this.ctx;
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

    createImageEmitter(x, y, color1=null, color2=null, mass=5, radius=5, target=null, rate1=100, rate2=200, damp=0.005, em='once', life=null) {
      var emitter = new Proton.Emitter();
      emitter.target = target;
      console.log(target);
      emitter.damping = damp;
      emitter.rate = new Proton.Rate(new Proton.Span(rate1, rate2));
      // emitter.rate = new Proton.Rate(new Proton.Span(50, 80), new Proton.Span(.1, .5));
      emitter.addInitialize(new Proton.Mass(mass));
      emitter.addInitialize(new Proton.Radius(radius));
      if (life) {
        emitter.addInitialize(new Proton.Life(life));
      }
      emitter.addInitialize(new Proton.Velocity(new Proton.Span(2,4), new Proton.Span(0, 369), 'polar'));
      emitter.addBehaviour(new Proton.RandomDrift(5, 5, .05));
      color1 && color2 ?
      emitter.addBehaviour(new Proton.Color(color1, color2)) :
      emitter.addBehaviour(new Proton.Color('random'));
      // emitter.addBehaviour(new Proton.Scale(3.5, 0.5));
      var crossZoneBehaviour = new Proton.CrossZone(new Proton.RectZone(0, 0, this.protonCanvas.width, this.protonCanvas.height), 'bound');
      emitter.addBehaviour(crossZoneBehaviour);
      var mouseAttract = new Proton.Attraction(this.mouseObj, 5, 200);
      emitter.addBehaviour(mouseAttract);
      this.attractionBehaviours.push(mouseAttract);
      if (target) {
        var planetAttraction = new Proton.Attraction(target, 15, 500);
        emitter.addBehaviour(planetAttraction);
        emitter.planetAttraction = planetAttraction;
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
      emitter.addInitialize(new Proton.Radius(15));
      emitter.addInitialize(new Proton.Velocity(new Proton.Span(3,5), new Proton.Span(emitDirection-15, emitDirection+15), 'polar'));
      // if (target.vx && target.vy) {
      //   emitter.addInitialize(new Proton.Force(target.vx*120, target.vy*120))
      // }
      emitter.addBehaviour(new Proton.RandomDrift(10, 10, .05));
      emitter.addBehaviour(new Proton.Color(color1, color2));

      var crossZoneBehaviour = new Proton.CrossZone(new Proton.RectZone(0, 0, this.protonCanvas.width, this.protonCanvas.height), 'bound');
      emitter.addBehaviour(crossZoneBehaviour);
      var pointAttraction = new Proton.Attraction(target, 10, 400);
      emitter.addBehaviour(pointAttraction);
      emitter.pointAttraction = pointAttraction;
      emitter.p.x = target.x;
      emitter.p.y = target.y;
      emitter.emit('once');
      this.proton.addEmitter(emitter);

      return emitter;
    }

    emitterRun() {
      // //not used now
      // this.emitter1.p.x = this.protonCanvas.width / 2 + this.conf.radius * Math.sin(Math.PI / 2 + conf.tha);
      // this.emitter1.p.y = this.protonCanvas.height / 2 + this.conf.radius * Math.cos(Math.PI / 2 + conf.tha);
      // this.emitter2.p.x = this.protonCanvas.width / 2 + this.conf.radius * Math.sin(-Math.PI / 2 + conf.tha);
      // this.emitter2.p.y = this.protonCanvas.height / 2 + this.conf.radius * Math.cos(-Math.PI / 2 + conf.tha);
    }

    mousedownHandler(e) {

      this.clickEmitter.emit('once');
      this.mousedown = true;
      for (let a of this.attractionBehaviours) {
        a.reset(this.mouseObj, 25, 600);
      }
      this.mousemoveHandler(e);
    }

    mouseupHandler(e) {
      this.mousedown = false;
      for (let a of this.attractionBehaviours) {
        a.reset(this.mouseObj, 5, 200);
      }
    }

    mousemoveHandler(e) {
      if (this.mousedown) {
        var _x, _y;
        if (e.layerX || e.layerX == 0) {
          _x = e.layerX;
          _y = e.layerY;
        } else if (e.offsetX || e.offsetX == 0) {
          _x = e.offsetX;
          _y = e.offsetY;
        }
        this.mouseObj.x = _x;
        this.mouseObj.y = _y;
      }
    }

    initProton() {
      this.conf = { radius: 170, tha: 0 };
      this.mouseObj = {
        x: this.protonCanvas.width / 2,
        y: this.protonCanvas.height / 2
      };
      this.mousedown = false;
      this.protonCanvas.addEventListener('mousedown', this.mousedownHandler, false);
      this.protonCanvas.addEventListener('mouseup', this.mouseupHandler, false);
      this.protonCanvas.addEventListener('mousemove', this.mousemoveHandler, false);
      this.createProton();
    }

    componentDidMount() {
      //proton
      this.initProton();

    }

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
        for (let planet of bodies) {
          this.drawConnect(planet, this.props.ball);
          this.drawPlanet(planet);
        }
        this.drawBall();
        this.drawLayer(7, (Math.PI*2)*0.008*this.tick, 0.3, 240);
        this.drawLayer(9, (Math.PI*2)*0.003*this.tick, 0.3, 270);
        this.drawLayer(5, (Math.PI*2)*0.005*this.tick, 0.4, 125);
        this.drawScore();
        // this.ctx.restore();
        this.tick = this.props.tick;
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
      // this.ctx.lineTo(origin.x+(target.x-origin.x)*2/12, origin.y+(target.y-origin.y)*2/12);
      // this.ctx.moveTo(origin.x+(target.x-origin.x)*3/12, origin.y+(target.y-origin.y)*3/12);
      // this.ctx.lineTo(origin.x+(target.x-origin.x)*5/12, origin.y+(target.y-origin.y)*5/12);
      // this.ctx.moveTo(origin.x+(target.x-origin.x)*6/12, origin.y+(target.y-origin.y)*6/12);
      // this.ctx.lineTo(origin.x+(target.x-origin.x)*8/12, origin.y+(target.y-origin.y)*8/12);
      // this.ctx.moveTo(origin.x+(target.x-origin.x)*9/12, origin.y+(target.y-origin.y)*9/12);
      // this.ctx.lineTo(origin.x+(target.x-origin.x)*11/12, origin.y+(target.y-origin.y)*11/12);

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

    drawBall() {
      const ball = this.props.ball;
      const {x, y, size, color} = ball;
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

    drawLayer(s, a, gap, r) {
      let seg = s;
      let ast = a;
      for (var i=0;i<seg;i++) {
        this.drawSegment(seg, ast, gap, r);
        ast += (Math.PI*2)
      }
    }
    drawSegment(seg, ast, gap, r) {
      this.ctx.beginPath();
      this.ctx.arc(this.width/2, this.height/2, r, ast/seg, (((Math.PI*2)*(1-gap))/seg)+ast/seg, false);
      this.ctx.lineWidth = 10;
      this.ctx.strokeStyle = "#E0E0E0";
      this.ctx.stroke();
      this.ctx.closePath();
    };

    render() {
      return (
        <PureCanvas width={this.props.screen.width} height={this.props.screen.height} contextRef={this.saveContext} />
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
        }
        />
      );
    }
  }



  const domContainer = document.querySelector('#game-wrapper');
  // ReactDOM.render(e(OrbitGame), domContainer);
  ReactDOM.render(<OrbitGame testProp="yes" />, domContainer);
