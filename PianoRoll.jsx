import React from 'react';
import classNames from 'classnames';
import { Button, ButtonGroup, Glyphicon, ButtonToolbar } from 'react-bootstrap';

import PianoRollNote from './PianoRollNote.jsx';
import PianoRollSelection from './PianoRollSelection.jsx';
import { addNote, removeNotes, moveNotes } from './action-creators';

import './PianoRoll.css';

const noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
const editModes = {
  draw: 'draw',
  select: 'select',
  erase: 'erase',
};
const defaultDrawNote = {inProgress: false, duration: 1, tone: 0, start: 0};
const defaultDrag = { inProgress: false, startBeat: 0, startTone: 0, shiftX: 0, shiftY: 0 };
const defaultSelection = { active: false, startX: 0, startY: 0, top: 0, left: 0, right: 0, bottom: 0 };

const noteWidth = 25;
const noteHeight = 16;

function getNoteFromIndex(index) {
  const octave = Math.floor(index/12);
  const name = noteNames[index % 12];
  const isBlack = name.indexOf('#') !== -1;
  return { octave, name, isBlack };
}

function doRectanglesIntersect(r1, r2) {
  return !(r2.left > r1.right || r2.right < r1.left || r2.top > r1.bottom || r2.bottom < r1.top);
}

function getNoteRectangle(note) {
  return {
    left: note.start * noteWidth,
    top: (keyCount - note.tone) * noteHeight,
    right: (note.start + note.duration) * noteWidth,
    bottom: (keyCount - note.tone) * noteHeight + noteHeight
  };
}

const keyCount = 60;
const keyCountArray = Array.apply(null, {length: keyCount}).map(Number.call, Number).reverse();
const keyLanes = keyCountArray.map((i) => {
  return <div key={i} className="PianoRoll-lane"></div>;
});
const keyList = keyCountArray.map((i) => {
  const note = getNoteFromIndex(i);
  const keyClasses = {
    'PianoRoll-key-black' : note.isBlack,
    'PianoRoll-key-white' : !note.isBlack
  };
  return <div key={i} className={classNames('PianoRoll-key', keyClasses)}>{note.name}{note.octave}</div>;
});

class PianoRoll extends React.Component {
  constructor() {
    super();
    this.updateNotes = this.updateNotes.bind(this);
    this.getGridPosition = this.getGridPosition.bind(this);
    this.getNoteByPosition = this.getNoteByPosition.bind(this);
    this.noteDragMouseUp = this.noteDragMouseUp.bind(this);
    this.noteDragMouseMove= this.noteDragMouseMove.bind(this);
    this.isClickOutOfSequencer = this.isClickOutOfSequencer.bind(this);
  }
  componentWillMount() {
    this.setState({
      drag: defaultDrag,
      displayedNotes: [],
      editMode: editModes.draw,
      drawNote: defaultDrawNote,
      selectedNotes: [],
      selection: defaultSelection,
    });
    this.noteMapper = this.noteMapper.bind(this);
    this.props.store.subscribe(this.updateNotes);
    document.onselectstart = () => false;
    document.ondragstart = () => false;    
  }
  componentDidMount() {
    this.sequencer.onscroll = () => {
      this.keyboard.style.top = (-this.sequencer.scrollTop) + 'px';
    };
    this.sequencer.onselectstart = () => false;
    this.sequencer.ondragstart = () => false;
    this.updateNotes();
  }
  isClickOutOfSequencer(pageX, pageY) {
    return (pageX >= this.sequencer.offsetLeft + this.sequencer.offsetWidth - 20 ||
        pageY >= this.sequencer.offsetTop + this.sequencer.offsetHeight - 20);
  }
  noteMapper(note, i) {
    return <PianoRollNote key={i}
    uniqueId={'gridNote_' + i}
    left={note.start*noteWidth} 
    top={(keyCount - note.tone) * noteHeight}
    width={note.duration * noteWidth}
    selected={this.state.selectedNotes.indexOf(i) !== -1}
    />;
  }
  setEditMode(mode) {
    this.setState({drawNote: defaultDrawNote});
    this.setState({editMode: mode});
  }
  updateNotes() {
    this.setState({displayedNotes: this.props.store.getState().notes.map(this.noteMapper)});
  }
  getNoteByPosition(beat, tone) {
    const foundNoteIndexes = this.props.store.getState().notes.reduce((found, note, index) => {
      if  (note.start <= beat && (note.start + note.duration >= beat) && note.tone === tone) {
        return found.concat([index]);
      }
      return found;
    }, []);
    if (foundNoteIndexes) {
      return foundNoteIndexes[0];
    }
  }
  getGridPosition(pageX, pageY) {
    let beat = Math.floor((pageX - this.sequencer.offsetLeft + this.sequencer.scrollLeft)/noteWidth);
    if (beat < 0) {
      beat = 0;
    }
    let tone = keyCount - Math.floor((pageY - this.sequencer.offsetTop + this.sequencer.scrollTop)/noteHeight);
    if (tone >= keyCount) {
      tone = keyCount;
    }
    return {beat, tone};
  }
  noteDragMouseUp(e) {
    document.onmousemove = null;
    document.onmouseup = null;
    const relativeX = e.pageX - this.state.drag.shiftX;
    const relativeY = e.pageY - this.state.drag.shiftY;
    const {beat, tone} = this.getGridPosition(relativeX, relativeY);
    const beatDistance = beat - this.state.drag.startBeat;
    const toneDistance = tone - this.state.drag.startTone;
    if (beatDistance === 0 && toneDistance == 0) {
      this.state.selectedNotes.map(i => document.getElementById('gridNote_' + i)).map((note, i) => {
        note.style.left = (this.props.store.getState().notes[i].start + beatDistance) * noteWidth + 'px';
        note.style.top = (keyCount - this.props.store.getState().notes[i].tone - toneDistance) * noteHeight + 'px';
      });
      this.setState({drag: defaultDrag, selectedNotes: []});      
    } else {
      this.setState({drag: defaultDrag, selectedNotes: []});      
      this.props.store.dispatch(moveNotes(this.state.selectedNotes, beatDistance, toneDistance));  
    }
    return false;
  }
  noteDragMouseMove(e) {
    const relativeX = e.pageX - this.state.drag.shiftX;
    const relativeY = e.pageY - this.state.drag.shiftY;
    const {beat, tone} = this.getGridPosition(relativeX, relativeY);
    const beatDistance = beat - this.state.drag.startBeat;
    const toneDistance = tone - this.state.drag.startTone;
    console.log(beatDistance, toneDistance);
    this.state.selectedNotes.map(i => document.getElementById('gridNote_' + i)).map((note, i) => {
      note.style.left = (this.props.store.getState().notes[i].start + beatDistance) * noteWidth + 'px';
      note.style.top = (keyCount - this.props.store.getState().notes[i].tone - toneDistance) * noteHeight + 'px';
    });
  }
  onSequencerMouseDown({pageX, pageY}) {
    if (this.isClickOutOfSequencer(pageX, pageY)) {
      return false;
    }
    const mode = this.state.editMode;
    if (mode === editModes.draw) {
      const {beat, tone} = this.getGridPosition(pageX, pageY);
      const noteUnderMouse = this.getNoteByPosition(beat, tone);
      if (noteUnderMouse >= 0) {
        const target = document.getElementById('gridNote_' + noteUnderMouse);
        const shiftX = pageX - this.sequencer.offsetLeft + this.sequencer.scrollLeft - parseInt(target.style.left, 10);
        const shiftY = pageY - this.sequencer.offsetTop + this.sequencer.scrollTop - parseInt(target.style.top, 10);
        let newSelection = this.state.selectedNotes;        
        if (newSelection.indexOf(noteUnderMouse) === -1) {
          newSelection = [noteUnderMouse];
        }
        this.setState({
          selectedNotes: newSelection,
          drag: {
            inProgress: true,
            startBeat: beat,
            startTone: tone,
            shiftX,
            shiftY
          }
        });
        document.onmousemove = this.noteDragMouseMove;
        document.onmouseup = this.noteDragMouseUp;
        return false;
      }
      this.setState({
        selectedNotes: [],
        drawNote: {
          start: beat, 
          tone, 
          inProgress: true, 
          duration: 1
        }
      });
    }
    if (mode === editModes.select) {
      const startX = pageX - this.sequencer.offsetLeft + this.sequencer.scrollLeft;
      const startY = pageY - this.sequencer.offsetTop + this.sequencer.scrollTop;
      this.setState({ selection: {
        active: true,
        startX,
        startY,
        left: startX,
        top: startY,
        right: 0,
        bottom: 0
      }});
    }
    return false;    
  }
  onSequencerMouseUp({pageX, pageY}) {
    if (this.isClickOutOfSequencer(pageX, pageY)) {
      return false;
    }    
    const { beat, tone } = this.getGridPosition(pageX, pageY);
    const mode = this.state.editMode;
    if (mode === editModes.draw) {
      if (!this.state.drag.inProgress && this.state.drawNote.inProgress) {
        this.props.store.dispatch(addNote(this.state.drawNote.tone, this.state.drawNote.start, this.state.drawNote.duration));
        this.setState({drawNote: defaultDrawNote});
      }
    }
    if (mode === editModes.erase) {
      const noteUnderMouse = this.getNoteByPosition(beat, tone);
      this.props.store.dispatch(removeNotes([noteUnderMouse]));
    }
    if (mode === editModes.select) {
      const newlySelectedNotes = this.props.store.getState().notes.reduce((acc, note, index) => {
        if (doRectanglesIntersect(getNoteRectangle(note), this.state.selection)) {
          return acc.concat(index);
        }
        return acc;
      }, []);
      this.setState({selection: defaultSelection, selectedNotes: newlySelectedNotes});
      this.setState({displayedNotes: this.props.store.getState().notes.map((note, i) => {
        return <PianoRollNote key={i}
          uniqueId={'gridNote_' + i}
          left={note.start*noteWidth} 
          top={(keyCount - note.tone) * noteHeight}
          width={note.duration * noteWidth}
          selected={newlySelectedNotes.indexOf(i) !== -1}
          />;
      })});
    }    
    return false;
  }
  onSequencerMouseMove({pageX, pageY}) {
    const mode = this.state.editMode;
    if (mode === editModes.draw) {
      const {beat, tone} = this.getGridPosition(pageX, pageY);
      if (!this.state.drag.inProgress && this.state.drawNote.inProgress) {
        const calculatedDuration = 1 + beat - this.state.drawNote.start;
        this.setState({
            drawNote: {
            duration: calculatedDuration >= 1 ? calculatedDuration : 1, 
            tone,
            start: this.state.drawNote.start,
            inProgress: true
          }
        });
      }
    }
    if (mode === editModes.select) {
      if (this.state.selection.active) {
        const x1 = this.state.selection.startX;
        const y1 = this.state.selection.startY;        
        const x2 = pageX - this.sequencer.offsetLeft + this.sequencer.scrollLeft;
        const y2 = pageY - this.sequencer.offsetTop + this.sequencer.scrollTop;
        this.setState({ selection: {
          startX: x1,
          startY: y1,
          active: true,
          left: Math.min(x1, x2),          
          top: Math.min(y1, y2),
          right: Math.max(x1, x2),
          bottom: Math.max(y1, y2),
        }});
      }
    }    
    return false;
  }
  render() {
    return (
      <div>
      <div className="PianoRoll-toolbar">
      <ButtonToolbar>
        <ButtonGroup>
          <Button active={this.state.editMode === editModes.draw} onClick={() => this.setEditMode(editModes.draw) }><Glyphicon glyph="pencil" /></Button>
          <Button active={this.state.editMode === editModes.erase} onClick={() => this.setEditMode(editModes.erase) }><Glyphicon glyph="remove" /></Button>
          <Button active={this.state.editMode === editModes.select} onClick={() => this.setEditMode(editModes.select) }><Glyphicon glyph="unchecked" /></Button>
        </ButtonGroup>
      </ButtonToolbar>
      </div>
      <div style={{height: this.props.height, width: this.props.width}}>
        <div className="PianoRoll-keylist-outer">
          <div className="PianoRoll-keylist-inner" ref={(c) => this.keyboard = c}>
          {keyList}
          </div>
        </div>
        <div className="PianoRoll-lane-outer" ref={(c) => this.sequencer = c}
            onMouseDown={(e) => { this.onSequencerMouseDown(e); return false; }}
            onMouseUp={(e) => { this.onSequencerMouseUp(e); return false; }}
            onMouseMove={(e) => { this.onSequencerMouseMove(e); return false; }}>
          <div className="PianoRoll-lane-inner">
          {keyLanes}
          {this.state.displayedNotes}
          <PianoRollNote display={this.state.drawNote.inProgress ? 'block' : 'none'} 
            key='drawNote'
            left={this.state.drawNote.start*noteWidth} 
            top={(keyCount - this.state.drawNote.tone)*noteHeight}
            width={this.state.drawNote.duration * noteWidth}
          />
          <PianoRollSelection rect={this.state.selection}></PianoRollSelection>          
          </div>
        </div>
      </div>
      </div>
      );
  }
}

export default PianoRoll;
