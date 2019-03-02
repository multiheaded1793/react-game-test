'use strict';
// import Proton from './Proton';

//global constants
const fps = 75;
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

//various utility

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

//game logic and animation
class OrbitGame extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      screen: {
        width: this.props.width,
        height: this.props.height,
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
        thrustAcc: 0.1,
        heading: 0,
        power: 0,
        color: "#E0EDFF",
        glow: 1,
      },
      resources: {
        matter: 0,
        energy: 1500,
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
      mouseTick: 0,
      mouseObj: {
        x: 350,
        y: 350,
        init: false,
      },
      tick: 0,
      ts: 0,
      randomNumber: 0,
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
    var sol = new Body(solData);
    createdBodies.push(sol);
    var mars = new Body(marsData, sol);
    createdBodies.push(mars);
    var venus = new Body(venusData, sol);
    createdBodies.push(venus);
    var earth = new Body(earthData, sol);
    createdBodies.push(earth);
    var phobos = new Body(phobosData, mars);
    createdBodies.push(phobos);
    var saturn = new Body(saturnData, sol);
    createdBodies.push(saturn);

    let createdStructures = this.state.world.structures;
    const s1 = new ringStructure({numSeg: 5, gap: 0.3, radius: 190, speed: 1, origin: {x: 350, y: 350}, width: 20, hue: "#DF73FF"})
    s1.addSegments();
    s1.destroyRandom();
    // s1.destroySegment(s1.segments[1]);
    // s1.destroySegment(s1.segments[1]);
    createdStructures.push(s1);
    const s2 = new ringStructure({numSeg: 15, gap: 0.2, radius: 320, speed: 0.7, origin: {x: 350, y: 350}, width: 12, hue: "#FFE4E1"})
    s2.addSegments();
    s2.destroyRandom();
    s2.destroyRandom();
    s2.destroyRandom();
    s2.destroyRandom();
    createdStructures.push(s2);
    const s3 = new ringStructure({numSeg: 2, gap: 0.2, radius: 50, speed: 0.5, origin: {x: 350, y: 350}, width: 10, hue: "#E0FFFF"})
    s3.addSegments();
    createdStructures.push(s3);
  }

  randomMagicNumber = () => {
    return this.setState({
      randomNumber: _.random(100),
    });
  }

  planetCollision(origin, body, type) {
    if (objectDistance(origin, body)*0.9 < body.size + origin.size) {
      //need to calculate accel here
      // console.log(this.state.world.bodies.indexOf(body));
      if (type === 1) {
        this.setState((prevState) => {
          return {
            currentScore: prevState.currentScore + 1,
            ball: {
              ...prevState.ball,
              x: prevState.ball.x-(prevState.ball.vx * this.state.params.bounceDampening * 0.5),
              y: prevState.ball.y-(prevState.ball.vy * this.state.params.bounceDampening * 0.5),
              vx: -prevState.ball.vx * this.state.params.bounceDampening,
              vy: -prevState.ball.vy * this.state.params.bounceDampening,
            }
          }
        });
      }
      if (type === 2) {
        // console.log(`Crash! ${origin.name}/${body.name}`)
        this.setState((prevState) => {
          let newBodies = prevState.world.bodies;
          let b = newBodies[newBodies.indexOf(body)];
          let o = newBodies[newBodies.indexOf(origin)];
          if (o.speed) {
            o.dx += towardsBody(origin, body).x*(o.coll*o.size/8)*(b.mass/o.mass);
            o.dy += towardsBody(origin, body).y*(o.coll*o.size/8)*(b.mass/o.mass);
            o.coll += 2;
          }
          // if (b.speed) {
            // b.x -= towardsBody(body, origin).x*5*o.mass/b.mass;
            // b.y -= towardsBody(body, origin).y*5*o.mass/b.mass;
            // b.dx += towardsBody(body, origin).x*(b.coll*b.size/10)*o.mass/b.mass;
            // b.dy += towardsBody(body, origin).y*(b.coll*b.size/10)*o.mass/b.mass;
            // b.coll += 2;
          // }
          return {
            resources: {
              ...prevState.resources,
              matter: prevState.resources.matter+1,
            },
            bodies: newBodies,
          }
        });
      }
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

  gravBall(object, targets) {
    for (let body of targets) {
      let dist = objectDistance(object, body);
      let gx = body.mass*towardsBody(object, body).x/Math.pow(dist * this.state.params.gravFalloff, 2);
      let gy = body.mass*towardsBody(object, body).y/Math.pow(dist * this.state.params.gravFalloff, 2);
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

  structureCollision() {
    let ball = this.state.ball;
    // let angle = ((Victor(ball.x-350, ball.y-350).angle()+(Math.PI*6/2))%Math.PI).toFixed(3);
    let angle = (Victor(ball.x-350, ball.y-350).verticalAngle()).toFixed(3);
    for (let struct of this.state.world.structures) {
      if (objectDistance(ball,struct.origin) > struct.radius*0.95 && objectDistance(ball,struct.origin) < struct.radius*1.05) {
        for (let seg of struct.segments) {
          if (seg.bc > seg.ac && angle > seg.ac && angle < seg.bc) {
            console.log("A");
            this.setState((prevState) => {
              return {
                ball: {
                  ...prevState.ball,
                  vx: -prevState.ball.vx * prevState.params.bounceDampening,
                  vy: -prevState.ball.vy * prevState.params.bounceDampening,
                }
              }
            });
          }
          else if (seg.ac > seg.bc && (angle<seg.ac||angle>seg.bc)) {
            console.log("B");
            this.setState((prevState) => {
              return {
                ball: {
                  ...prevState.ball,
                  vx: -prevState.ball.vx * prevState.params.bounceDampening,
                  vy: -prevState.ball.vy * prevState.params.bounceDampening,
                }
              }
            });
          }
        }
      }
    }
  }

  planetMotion() {
    const bodies = this.state.world.bodies;
    //apply a pulling force, costs energy
    if (this.state.mousedown && this.state.resources.energy > 0 && this.state.mouseTick%1==0) {
      for (let planet of bodies) {
        planet.getsPulled(15, this.state.mouseObj, this.state.mouseTick)
      }
      this.setState((prevState) => {
        return {
          resources: {
            ...prevState.resources,
            energy: prevState.resources.energy-1,
          }
        }
      })
    };
    //normal motion
    for (let planet of bodies) {
      let otherBodies = bodies.filter(item => item !== planet);
      for (let body of otherBodies) {
        this.planetCollision(planet, body, 2)
      }
    };
    for (let planet of bodies) {
      planet.orbitX ? planet.movePlanet() : null;
    };
  }

  moveBall() {
    const ball = this.state.ball;
    const bodies = this.state.world.bodies;
    this.borderCollision(ball);
    this.gravBall(ball, bodies);
    for (let body of bodies) {
      this.planetCollision(ball, body, 1)
    }
    // this.structureCollision();
    this.thrustInput();
    const speed = objectDistance(ball, {x: ball.vx, y:ball.vy});
    this.setState((prevState) => {
      return {
        ball: {
          ...prevState.ball,
          x: prevState.ball.x + prevState.ball.vx,
          y: prevState.ball.y + prevState.ball.vy,
          speed: speed,
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
        },
      }
    });
  }

  increasePsi() {
    this.setState((prevState) => {
      return {
        resources: {
          ...prevState.resources,
          psi: prevState.resources.psi+1,
        },
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
      return { keys: keys }
    });
  }

  mousedownHandler(e) {
    this.mousemoveHandler(e);

    // console.log(this.state.world.structures[0].segments[1])
    // console.log(this.state.world.structures[0].segments[2])
    this.setState((prevState) => {
      return {
        mousedown: true,
       }
    });
    if (!this.state.mouseObj.init) {
      this.setState((prevState) => {
        return {
          mouseObj: {
            ...prevState.mouseObj,
            init: true,
          }
         }
      });
    }
    console.log((Victor(this.state.mouseObj.x-350, this.state.mouseObj.y-350).angle()+(Math.PI*6/2))%Math.PI)
    console.log(this.state.world.structures[0].segments[0])
  }

  mouseupHandler(e) {
    this.setState((prevState) => {
      return { mousedown: false }
    });
  }

  mousemoveHandler(e) {
    if (this.state.mousedown||!this.state.mouseObj.init) {
      // console.log(e)
      var _x = e.clientX - e.currentTarget.getBoundingClientRect().x;
      var _y = e.clientY - e.currentTarget.getBoundingClientRect().y;
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
    this.setState(() => {
      return { inGame: true, }
    });
  }

  stopGame() {
    clearInterval(this.timerID);
    cancelAnimationFrame(this.animationID);
    this.setState(() => {
      return { inGame: false, }
    });
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
          mouseTick: prevState.mousedown ? prevState.mouseTick+1 : 0,
        }
      });

      this.planetMotion();
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

    const readyCanvas = this.state.world.bodies.length > 0 ?
    <GameCanvas onMouseDown={this.mousedownHandler} onMouseUp={this.mouseupHandler} onMouseMove={this.mousemoveHandler} {...this.state} /> :
    null;
    //interface elements
    const ui = {
      tick: this.state.tick,
      ts: this.state.ts,
      inGame: this.state.inGame,
      currentScore: this.state.currentScore,
      ball: this.state.ball,
      resources: this.state.resources,
      mousedown: this.mousedown,
    }
    const pause = this.state.inGame ?
    <Button onClick={this.handlePauseStart} style={{ backgroundColor: 'red' }} text="Pause" /> :
    <Button onClick={this.handlePauseStart} text="Continue" />;
    const sparklebutton = <Button onClick={this.increasePsi} style={{ backgroundColor: '#4666FF' }} text={`Psi blasts: ${this.state.resources.psi}`} />;
    const pullbutton = <Button onClick={this.handlePowerChange} style={{ backgroundColor: '#E0115F' }} text={`Energy: ${this.state.resources.energy} (click to charge)`} />;

    return (
      <div className="showcase">
      {readyCanvas}
      <GUIWrap ui={ui}>
      <StatsDisplay ui={ui} />
      <ButtonBlock ui={ui}>
      {pause}{sparklebutton}{pullbutton}
      </ButtonBlock>
      </GUIWrap>
      </div>
    );
  }
};

//interface here
const GUIWrap = ({ ui, children }) => (
  <div className="game-interface">
  {children}
  </div>
);

const StatsDisplay = ({ ui }) => (
  <div className="interface-element">
  <p>{`Energy: ${ui.resources.energy} || Matter: ${ui.resources.matter} || Psi: ${ui.resources.psi} || Score: ${ui.currentScore}`}</p>
  </div>
);

const ButtonBlock = ({ ui, children }) => (
  <div className="interface-element">
  {children}
  </div>
);

const Button = ({ onClick, text, style }) => (
  <button onClick={onClick} type="button" style={style}>
  {text}
  </button>
);

//game logic
class Body {
  constructor(data, parent=null) {
    this.data = data;
    this.parent = parent;
    this.xPar = this.parent ? this.parent.x : data.xPar||350;
    this.yPar = this.parent ? this.parent.y : data.yPar||350;
    // if (this.parent) {
    //   this.xPar = this.parent.x
    //   this.yPar = this.parent.y
    // }
    this.size = data.size||15;
    this.orbitX = data.orbitX||0;
    this.orbitY = data.orbitY||this.orbitX;
    this.rot = data.rot||0;
    if (this.orbitX!==this.orbitY) {
      this.e = Math.sqrt(1 - (Math.pow(this.orbitY, 2)/Math.pow(this.orbitX, 2)));
      this.pfdist = new Victor(this.orbitX*this.e, 0)
      this.pfdist.rotateDeg(this.rot);
      this.pf = {
        x: this.xPar + this.pfdist.x,
        y: this.yPar + this.pfdist.y,
      }

      console.log(this.pf);
      this.per = this.orbitX-this.orbitX*this.e;
      this.aph = this.orbitX+this.orbitX*this.e;
    }
    this.speed = data.speed||0;
    this.speedWarp = 0;
    this.mass = data.mass||0;
    this.hue = data.hue||"#FFFF00";
    this.glow = data.glow||0;
    this.name = data.name||"Unknown";
    this.angle = data.angle||0;
    this.x = this.xPar + this.orbitX;
    this.y = this.yPar + this.orbitY;
    this.dx = 0;
    this.dy = 0;
    this.coll = 0;
    console.log("creating body: "+this.name);
  }

  getsPulled(force, target, tick=0) {
    let dist = objectDistance(this, target);
    let fade = 1+(tick*0.05)
    this.speedWarp = (force*200/this.mass)/(Math.pow(dist * 0.5, 1.1)*fade);
    // console.log(this.speedWarp);
    if (dist > this.size*1.2)  {
      this.dx -= force*towardsBody(this, target).x/(Math.pow(dist * 0.04, 1.1)*fade);
      this.dy -= force*towardsBody(this, target).y/(Math.pow(dist * 0.04, 1.1)*fade);
    }
  }

  // Adding a method to the constructor
  movePlanet() {
    this.angle += Math.acos(1 - Math.pow((this.speed/(1+this.speedWarp)) / this.orbitX, 2) / 2);

    if (this.parent) {
      this.xPar = this.parent.x;
      this.yPar = this.parent.y;
      if (this.orbitX!==this.orbitY) {
        this.xPar -= this.pfdist.x;
        this.yPar -= this.pfdist.y;
      }
    }
    if (this.orbitX===this.orbitY) {
      this.x = this.xPar + this.orbitX * Math.cos(this.angle) + this.dx;
      this.y = this.yPar + this.orbitY * Math.sin(this.angle) + this.dy;
    }
    else {
      let el = new Victor(this.orbitX * Math.cos(this.angle), this.orbitY * Math.sin(this.angle))
      el.rotateDeg(this.rot)
      this.x = this.xPar + el.x + this.dx;
      this.y = this.yPar + el.y + this.dy;
    }
    if (this.dx) {
      this.dx = Math.floor(this.dx*0.98)
    }
    if (this.dy) {
      this.dy = Math.floor(this.dy*0.98)
    }
    if (this.speedWarp) {
      this.speedWarp = Math.floor(this.speedWarp*0.75)
    }
    if (this.coll) {
      this.coll--;
    }
  };
}

const marsData = {
  size: 9,
  orbitX: 240,
  orbitY: 235,
  rot: 60,
  speed: 2,
  mass: 100,
  hue: "#ff4336",
  glow: 0.8,
  angle: 0,
  name: "Mars",
}

const phobosData = {
  size: 7,
  orbitX: 40,
  speed: 1.5,
  mass: 50,
  hue: "#EE1111",
  glow: 0.6,
  angle: 30,
  name: "#Phobos",
}

const venusData = {
  // xPar: 350,
  // yPar: 350,
  size: 15,
  orbitX: 90,
  speed: 1,
  mass: 160,
  hue: "#00A86B",
  glow: 0.8,
  angle: 0,
  name: "Venus",
}

const earthData = {
  size: 12,
  orbitX: 145,
  speed: 1,
  mass: 140,
  hue: "#007FFF",
  glow: 1.2,
  angle: 120,
  name: "Earth",
}

const solData = {
  size: 19,
  orbitX: 0,
  speed: 0,
  mass: 210,
  hue: "#FFCC33",
  glow: 2.5,
  angle: 0,
  name: "Sol",
}

const saturnData = {
  size: 15,
  orbitX: 320,
  speed: 0.5,
  mass: 180,
  hue: "#d9b47d",
  glow: 1,
  angle: 210,
  name: "Saturn",
}

class ringStructure {
  constructor({numSeg=5, arg=0, gap=0.4, radius=240, speed=5, origin={x: 350, y: 350}, width=10, hue="#E0E0E0", glow=1}={}) {
    this.numSeg = numSeg;
    this.arg = arg;
    this.gap = gap;
    this.radius = radius;
    this.speed = speed;
    this.origin = origin;
    this.width = width;
    this.hue = hue;
    this.glow = glow;
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
    let glow = this.glow;
    for (let i=0;i<numSeg;i++) {
      let segment = {
        a: arg,
        b: arg + (Math.PI*2*(1-gap))/numSeg,
        r: r,
        ac: arg%(Math.PI*2),
        bc: (arg + (Math.PI*2*(1-gap))/numSeg)%(Math.PI*2),
        origin: origin,
        width: width,
        hue: hue,
        glow: glow,
        health: 3,
      };
      this.segments.push(segment);
      arg += (Math.PI*2)/numSeg;
    }
    console.log(this.segments);
  }

  destroySegment(seg) {
    const destroy = this.segments.filter(item => item !== seg);
    this.segments = destroy;
  }

  destroyRandom() {
    let rand = this.segments[_.random(this.segments.length)-1]
    this.destroySegment(rand);
  }

  moveSegments() {
    for (let seg of this.segments) {
      seg.a += Math.PI*2*0.001*this.speed;
      seg.ac = seg.a%(Math.PI);
      seg.b += Math.PI*2*0.001*this.speed;
      seg.bc = seg.b%(Math.PI);
    }
  }
}

//the canvas render is split into a dynamic wrapper and a nested non-updating actual canvas, idea by Phil Nash https://philna.sh/, elements from Reacteroids
class GameCanvas extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      zones: [],
    }
    this.saveContext = this.saveContext.bind(this);
    this.mouseTick = 0;
    this.mousedownevent = false;
    //proton
    // this.attractionBehaviours = [];
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
    this.createProton();
    console.log(this.props);
  }

  createProton() {
    this.proton = new Proton;
    // const pr = this.ctx;
    // const imageWidth = 342;
    // const drawScopeWidth = 710;
    // const rect = new Proton.Rectangle((this.protonCanvas.width - imageWidth) / 2, (this.protonCanvas.height - imageWidth) / 2, imageWidth, imageWidth);
    // const rect2 = new Proton.Rectangle((this.protonCanvas.width - drawScopeWidth) / 2, 0, drawScopeWidth, this.protonCanvas.height);
    // const rectZone = new Proton.RectZone(rect2.x, rect2.y, rect2.width, rect2.height);
    // const zones = this.state.zones;
    // this.emitterList[0].addBehaviour(this.customToZoneBehaviour(zones[0], zones[1], zones[2]));
    this.crossZoneBehaviour = new Proton.CrossZone(new Proton.RectZone(0, 0, this.protonCanvas.width, this.protonCanvas.height), 'bound');
    this.randomBehaviour = new Proton.RandomDrift(5, 5, .05);
    // const gravityWellBehaviour = new Proton.GravityWell({
    //   x: this.protonCanvas.width / 2,
    //   y: this.protonCanvas.height / 2
    // }, 0, 0);


    this.emitterList.push(this.createImageEmitter(this.protonCanvas.width / 3, this.protonCanvas.height / 3, '#EE3355', '#0029CC', 6, 5, this.props.world.bodies[1]));
    this.emitterList.push(this.createImageEmitter(this.protonCanvas.width / 2, this.protonCanvas.height / 2, '#88FF99', '#EEBB35', 5, 5, this.props.world.bodies[2]), 150, 200, 0.009, 2, 3);
    this.emitterList.push(this.createImageEmitter(this.protonCanvas.width / 4, this.protonCanvas.height / 4, '#2292FF', '#2292FF', 5, 5, this.props.world.bodies[3], 80, 120));
    this.emitterList.push(this.createImageEmitter(this.protonCanvas.width / 3, this.protonCanvas.height / 4, '#FF2211', '#EEEEEE', 4, 10, this.props.world.bodies[4], 80, 100));
    this.emitterList.push(this.createImageEmitter(this.protonCanvas.width / 2, this.protonCanvas.height / 3, '#DD4400', '#EEEEEE', 5, 5, this.props.world.bodies[5], 100, 120));

    this.psiEmitter = this.createImageEmitter(this.props.ball.x, this.props.ball.y, '#FF4433', '#FFDDFF', 8, 10, this.props.ball, 40, 60, 0.01, 'once', (1,5));
    this.clickEmitter = this.createPointEmitter('#FF6FFF', '#FD1212', this.props.mouseObj);
    this.renderer = new Proton.CanvasRenderer(this.protonCanvas);

    // this.renderer.onProtonUpdate = function() {
    //   this.ctx.fillStyle = "rgba(0, 0, 0, 0.02)";
    //   this.ctx.fillRect(0, 0, protonCanvas.width, protonCanvas.height);
    // };
    this.renderer.onParticleUpdate = (particle) => {
      this.ctx.beginPath();
      this.ctx.globalAlpha = 0.9
      this.ctx.strokeStyle = particle.color;
      this.ctx.lineWidth = particle.radius/5;
      this.ctx.moveTo(particle.old.p.x, particle.old.p.y);
      this.ctx.lineTo(particle.p.x, particle.p.y);
      this.ctx.closePath();
      this.ctx.stroke();
      this.ctx.globalAlpha = 1
    };
    this.proton.addRenderer(this.renderer);
  }

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
    emitter.mouseAttract = new Proton.Attraction(this.mouseObj, 5, 200);
    emitter.addBehaviour(emitter.mouseAttract);
    // this.attractionBehaviours.push(mouseAttract);
    if (target) {
      emitter.planetAttraction = new Proton.Attraction(target, 10, 500);
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

  componentDidUpdate() {
    const bodies = this.props.world.bodies;
    if (this.props.tick > this.tick) {
      // this.ctx.save();
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
      this.drawScore();
      // this.ctx.restore();
      this.mouseInput()
      this.tick = this.props.tick;
    }
  }

  mouseInput() {
    if (this.props.mousedown == true) {
      //while mouse held down
      if (this.mouseTick % 10 == 0) {
        for (let a of this.emitterList) {
          if (a.mouseAttract) {
            a.mouseAttract.reset(this.props.mouseObj, 25, 600);
          }
        }
      }
      if (this.mouseTick % 40 == 0) {
        this.clickEmitter.emit('once');
      }
      if (this.mousedownevent == false) {
        //once per click
      }
      this.mouseTick++;
      this.mousedownevent = true;
    } else {
      if (this.mousedownevent == true) {
        //when mouse released
        for (let a of this.emitterList) {
          if (a.mouseAttract) {
            a.mouseAttract.reset(this.props.mouseObj, 5, 200);
          }
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
      if (em.planetAttraction) {
        em.planetAttraction.reset(em.target, 20, 500);
      }
    }
    if (this.psiEmitter) {
      this.psiEmitter.p.x = this.props.mouseObj.x;
      this.psiEmitter.p.y = this.props.mouseObj.y;
      this.psiEmitter.planetAttraction.reset(bodies[0], 25, 700)
    }
    if (this.clickEmitter) {
      this.clickEmitter.p.x = this.props.ball.x;
      this.clickEmitter.p.y = this.props.ball.y;
      this.clickEmitter.pointAttraction.reset(this.props.ball, 10, 500)
    }
  }

  drawConnect(origin, target) {
    this.ctx.beginPath();
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = '#4599DE';
    this.ctx.globalAlpha = 0.5
    this.ctx.strokeStyle = '#4397DC';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([40, 15]);
    this.ctx.lineDashOffset = 20
    this.ctx.moveTo(origin.x, origin.y);
    this.ctx.lineTo(target.x, target.y);
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 0;
    this.ctx.setLineDash([])
    this.ctx.globalAlpha = 1
  }

  drawScore() {
    const score = this.props.currentScore;
    this.ctx.fillStyle = "#F5F5F5";
    this.ctx.font = "22px Arial";
    this.ctx.fillText("x" + score, 10, 25);
  }

  drawBall(blur=1.5) {
    const ball = this.props.ball;
    const {x, y, vx, vy, size, color, glow} = ball;
    if (glow) {
      this.ctx.shadowBlur = glow*15;
      this.ctx.shadowColor = shadeColor(color, 10);
    }
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
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 0;
  }

  drawPlanet(p) {
    //outlines the orbit
    this.ctx.beginPath();
    p.orbitX!==p.orbitY ?
    this.ctx.ellipse(p.xPar, p.yPar, p.orbitX, p.orbitY, p.rot/360*(Math.PI*2), 0, Math.PI * 2, true) :
    // this.ctx.ellipse(p.pf.x, p.pf.y, p.orbitX, p.orbitY, p.rot, 0, Math.PI * 2, true) :
    this.ctx.arc(p.xPar, p.yPar, p.orbitX, 0, Math.PI * 2, false);
    this.ctx.lineWidth = 2;
    this.ctx.globalAlpha = 0.4;
    this.ctx.strokeStyle = "#E0E0E0";
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.globalAlpha = 1;
    //the planet itself
    this.ctx.beginPath();
    if (p.glow) {
      this.ctx.shadowBlur = p.glow*10;
      this.ctx.shadowColor = shadeColor(p.hue, 20);
    }
    this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    this.ctx.fillStyle = p.hue;
    this.ctx.fill();
    this.ctx.closePath();
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 0;
  };

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
    if (seg.glow) {
      this.ctx.shadowBlur = seg.glow*10;
      this.ctx.shadowColor = shadeColor(seg.hue, 10);
    }
    this.ctx.arc(seg.origin.x, seg.origin.y, seg.r, seg.a, seg.b, false);
    this.ctx.lineWidth = seg.width;
    this.ctx.strokeStyle = seg.hue;
    this.ctx.stroke();
    this.ctx.closePath();
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 0;
  }

  //to try later
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

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // You can also log the error to an error reporting service
    console.log(error, info);
    this.setState({
      error: error,
      info: info
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
        <h1>Something went wrong.</h1>
        <details style={{ whiteSpace: 'pre-wrap' }}>
        {this.state.error && this.state.error.toString()}
        <br />
        {this.state.info.componentStack}
        </details>
        </div>
      )
    }
    return this.props.children
  }
}

class MyApp extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return (
      <ErrorBoundary><OrbitGame width="700" height="700"/></ErrorBoundary>
    )
  }
}


const domContainer = document.querySelector('#game-wrapper');
ReactDOM.render(<MyApp />, domContainer);
