<script setup lang="ts">
import axios from 'axios';
import AppLayout from '@/layouts/AppLayout.vue';
import { SharedData, type BreadcrumbItem, type User } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/vue3';
import PlaceholderPattern from '../../components/PlaceholderPattern.vue';
import {onMounted, ref, watch, toRaw, useTemplateRef} from 'vue';
import { useDark, useToggle } from '@vueuse/core'

import "https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js"

import {useLoading} from 'vue-loading-overlay'
import 'vue-loading-overlay/dist/css/index.css';

//VueDatePicker: https://vue3datepicker.com/
import VueDatePicker from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css';

import 'bootstrap';


/**
 * Note
 * - auto validate when total hint == flagged
 * 		or board - hint == blank
 *
 * - reset is working the way I want it. I want to ogboard to store the prestine board but some ogboard is updating too when I change board
 *
 */
const breadcrumbs: BreadcrumbItem[] = [
	{
		title: 'Board',
		href: '/board',
	},
];
const $loading = useLoading({});

const props = defineProps({
	user:Object,
	size: String,
	year: String,
	month: String,
	day: String,
})
// const curUser = toRaw(prompt.user);
// const page = usePage<SharedData>();
// const user = page.props.auth.user as User;
// const curUser = toRaw(user);
// console.log(curUser);

const directions = {
	"left":[0,-1],
	"top":[-1,0],
	"right":[0,1],
	"bottom":[1,0],
}
const inverseDirections:object = {
	"left":'right',
	"top":'bottom',
	"right": 'left',
	"bottom":'top',
}
let isHighlighting = false;
let totalClue:number = 0;
let boardSize:number = 0;
let hints = [];
let ogboard:string[][] = [
	["  ","  ","  ","  ","  ","  "],
	["  ","  "," 5","  ","  ","  "],
	["  "," 1","  "," 2","  ","  "],
	["  ","  ","  ","  ","  "," 4"],
	[" 5","  ","  ","  ","  ","  "],
	["  ","  "," 2","  "," 1","  "],
	["  ","  ","  ","  ","  "," 3"],
	["  ","  ","  ","  ","  ","  "],
];
const move:any = ref([]);// :number[][] = [];
const move_r:any = ref([]);// :number[][] = [];

const difficulty = ref('');
const date = ref();

const dateFilter = ref();
const isOpenFilter = ref(false);

const gameTimer = ref("00:00");
const timerval1 = ref(0);
let timerRunning = false;
let interval1 = null;//setInterval(()=>{timerval1.value++}, 1000);

const board = ref([
	["  ","  ","  ","  ","  ","  "],
	["  ","  "," 5","  ","  ","  "],
	["  "," 1","  "," 2","  ","  "],
	["  ","  ","  ","  ","  "," 4"],
	[" 5","  ","  ","  ","  ","  "],
	["  ","  "," 2","  "," 1","  "],
	["  ","  ","  ","  ","  "," 3"],
	["  ","  ","  ","  ","  ","  "],
])

const boardClass:any = ref([]);
const boardZoom = ref(30);
const maxZoom = ref(40);
const minZoom = ref(6);

const isDark = useDark()
// const toggleDark = useToggle(isDark)

onMounted(()=>{
	difficulty.value = 'small';
	if(['small', 'medium', 'large'].includes(props.size)){
		difficulty.value = props.size;
	}
	const timezoneoffset = getTimezoneOffset();
	let initMonth = props.month||'';
	let initDay  = props.day||'';
	let initDate = '';

	if(initMonth.length<2) initMonth = '0'+initMonth;
	if(initDay.length<2) initDay = '0'+initDay;
	initDate = `${props.year||''}-${initMonth}-${initDay}T00:00:00${timezoneoffset}`
	date.value = new Date(initDate);
	if(date.value == 'Invalid Date'){
		if(props.year == null){
			date.value = new Date();
		}else{
			alert('Invalid date. ');
			return
		}
	}

	el = document.getElementById("wrap_board");
	el.onpointerdown = pointerdownHandler;
	el.onpointermove = pointermoveHandler;

	// Use same handler for pointer{up,cancel,out,leave} events since
	// the semantics for these events - in this app - are the same.
	el.onpointerup = pointerupHandler;
	el.onpointercancel = pointerupHandler;
	el.onpointerout = pointerupHandler;
	el.onpointerleave = pointerupHandler;

	$('main').css('overflow', 'auto')
	$('main').css('height', 'calc(100vh - 1em)')

	findPuzzleByDate()
})

watch(board, (newBoard)=>{
	$("#gameboard").removeClass('won');

	$('#btnReset').prop('disabled', false);
	$('#btnUndo').prop('disabled', false);
	$('#btnRedo').prop('disabled', false);
	$('#btnSave').prop('disabled', false);
	$('#btnLoad').prop('disabled', false);
	$('#rangeZoom').prop('disabled', false);
	boardZoom.value = minZoom.value;

	clearBoard(newBoard)

})
watch(timerval1, (newVal)=>{
	let second =  String(newVal%60).padStart(2,'0');
	let minute =  String(parseInt(newVal/60)).padStart(2,'0');
	gameTimer.value = minute+":"+second;
})
watch(boardZoom, (val)=>{
	// console.log(val);
	// $('#gameboard').css('transform', 'scale('+val+')');
	$('#nurikabe').css('--sqr_size', val+'px');
})

clearBoard(board.value)

function saveBoard(){
    localStorage.setItem('board', JSON.stringify(board.value??[[' ']]));
    localStorage.setItem('move', JSON.stringify(move.value??[[' ']]));

}
function loadBoard(){
	board.value = JSON.parse(localStorage.getItem('board')??"[[ ]]");
	move.value = JSON.parse(localStorage.getItem('move')??"[[ ]]");
	move_r.value = [];
}

function clearBoard(newBoard:any){
	totalClue = 0;
	boardSize = 0;
	hints = [];
	boardClass.value = [[]]
	newBoard.forEach((row:any,indexX:number) => {
		boardClass.value[indexX] = [];
		row.forEach((column:any, indexY:number) =>{
			boardClass.value[indexX][indexY] = {
				wall: column==" ■",
				visited:false,
				"wall_highlighted": false,
				"wall_highlighted-left": false,
				"wall_highlighted-top": false,
				"wall_highlighted-right": false,
				"wall_highlighted-bottom": false,
				"island_highlighted": false,
				'root_highlight':false,
				"roothint": "",
				hint: isNumber(column)
			}
			if(isNumber(column)){
				hints.push([indexX,indexY])
				totalClue+=parseInt(column);
			}
		});
	});
	boardSize = (newBoard.length)*(newBoard[0].length)
	isHighlighting = false;
	autofill();
}
function resetHighlighting(){
	if(!isHighlighting) return;

	clearHighlight();
	isHighlighting = false;
}

async function setSquare(x:number, y:number, state=''){
	const value = board.value[x][y];
	let validateDelay = null;

	clearTimeout(validateDelay);
	clearHighlight();

	if(isHighlighting){
		isHighlighting = false;
		if(state.length==2){
			return;
		}
	}
	if(isNumber(value)) return;
	if(!timerRunning){
		timerRunning = true;
		interval1 = setInterval(()=>{timerval1.value++}, 1000);
	}

	event.preventDefault();
	if(state=='down'){
		if(value== '  ') board.value[x][y] = ' ●';
		else if(value== ' ■')  board.value[x][y] = '  ';
		else if(value== ' ●')  board.value[x][y] = ' ■';
	}else{
		if(value== '  ') board.value[x][y] = ' ■';
		else if(value== ' ■')  board.value[x][y] = ' ●';
		else if(value== ' ●')  board.value[x][y] = '  ';
	}
	if(state == ''){
		move.value.push([x,y]);
		move_r.value= [];
	}
	// console.log(move.value);

	boardClass.value[x][y]['wall'] = board.value[x][y] == ' ■'
	setTimeout(validateBoard, 10);
}
function clearHighlight(){
	boardClass.value.forEach((row:any) => {
		row.forEach((element:any) => {
			element['visited']=false;
			element['wall_highlighted-left']=false;
			element['wall_highlighted-top']=false;
			element['wall_highlighted-right']=false;
			element['wall_highlighted-bottom']=false;
			element['island_highlighted']=false;
			element['root_highlight']=false;
			element['roothint']="";
		});
	});
}
async function highlightEntity(x:number,y:number){
	event.preventDefault();

	clearHighlight();

	isHighlighting = true;

	if(boardClass.value[x][y]['wall']){
		highlightWall([x,y])
	}
	if(isNumber(board.value[x][y])){
		await highlightIsland([x,y])
	}

}
async function highlightWall(square:number[]) {
	const queue = [square];

	for (let i = 0; i < queue.length; i++) {
		const value = queue[i];

		boardClass.value[value[0]][value[1]].visited = true;
		let neighboringSquare = [];

		Object.entries(directions).forEach(([direction,coord]) => {
			boardClass.value[value[0]][value[1]]['wall_highlighted-'+direction] = true;
			if(boardClass.value[value[0]+coord[0]] == undefined) return;

			neighboringSquare = boardClass.value[value[0]+coord[0]][value[1]+coord[1]];
			if(neighboringSquare== undefined) return;
			if(neighboringSquare.visited){
				boardClass.value[value[0]][value[1]]['wall_highlighted-'+direction]=false;
				boardClass.value[value[0]+coord[0]][value[1]+coord[1]]['wall_highlighted-'+inverseDirections[direction]]=false;
				return;
			}
			if(board.value[value[0]+coord[0]][value[1]+coord[1]] == '  '){
				neighboringSquare.island_highlighted = true;

			}
			if(!neighboringSquare.wall) return;

			queue.push([value[0]+coord[0],value[1]+coord[1]])
		});
	}
}
async function highlightIsland(square:number[], isIgnoreIsles = false) {
	return new Promise(async (resolve)=>{
		try{
			let queue = [square.toString()];
			const blankQueue:number[][] = [];
			let remainder = parseFloat(board.value[square[0]][square[1]]);
			let hintVal = remainder;

			//highlight the hint square and isle squares
			for (let i = 0; i < queue.length; i++) {
				const value = queue[i].split(',');
				value[0] = parseInt(value[0]);
				value[1] = parseInt(value[1]);

				boardClass.value[value[0]][value[1]].visited = true;
				boardClass.value[value[0]][value[1]].island_highlighted = true;
				boardClass.value[value[0]][value[1]].roothint = square.toString();

				Object.values(directions).forEach((coord:number[]) => {
					if(boardClass.value[value[0]+coord[0]] == undefined) return; //edge
					const neighboringSquare = boardClass.value[value[0]+coord[0]][value[1]+coord[1]];
					const newCoord = [value[0]+coord[0],value[1]+coord[1]];

					if(queue.includes(newCoord.toString())) return;
					if(neighboringSquare== undefined) return; //edge

					if(neighboringSquare.wall) return;
					if(neighboringSquare.roothint !== "" && neighboringSquare.roothint !== square.toString()){
						throw 1;
					}
					if(neighboringSquare.visited) return;
					if(isNumber(board.value[value[0]+coord[0]][value[1]+coord[1]])) return;

					if(board.value[value[0]+coord[0]][value[1]+coord[1]]== "  " || isIgnoreIsles){
						boardClass.value[value[0]+coord[0]][value[1]+coord[1]].visited=true
						blankQueue.push([value[0]+coord[0],value[1]+coord[1]])
					}else{
						queue.push(newCoord.toString());
					}
				});

				remainder=remainder-1;
				// if(isIgnoreIsles) break;
				// if(remainder==0) break;
			}

			$(`#item-${square[0]}_${square[1]}`).css('--count', "'"+(hintVal-remainder)+"'")
			boardClass.value[square[0]][square[1]].root_highlight = true;

			if(remainder <= 0){
				resolve(remainder);
				return;
			}

			blankQueue.forEach((value) => {
				value.push(remainder)
				boardClass.value[value[0]][value[1]]['visited'] = false;
			});

			queue = blankQueue;

			let spaceCtr = 0;

			//highlight blank squares
			for (let i = 0; i < queue.length; i++) {
				const value = queue[i];

				if(boardClass.value[value[0]][value[1]].visited) continue;
				if(!isValidBlank(value, isIgnoreIsles)) continue;

				boardClass.value[value[0]][value[1]].visited = true;
				boardClass.value[value[0]][value[1]]['island_highlighted'] = true;
				boardClass.value[value[0]][value[1]].roothint = square.toString();

				Object.values(directions).forEach((coord:number[]) => {
					if(boardClass.value[value[0]+coord[0]] == undefined) return;
					const neighboringSquare = boardClass.value[value[0]+coord[0]][value[1]+coord[1]];
					const newCoord = [value[0]+coord[0],value[1]+coord[1]];
					if(neighboringSquare== undefined) return;

					if(neighboringSquare.wall) return;
					if(neighboringSquare.roothint !== "" && neighboringSquare.roothint !== square.toString()){
						throw 1;
					}
					if(neighboringSquare.visited) return;
					if(isNumber(board.value[value[0]+coord[0]][value[1]+coord[1]])) return;


					if(value[2]==1) return;
					const r = value[2]-1

					queue.push([value[0]+coord[0],value[1]+coord[1], r])
				});
				spaceCtr++
			}
			remainder-=spaceCtr;
			resolve(remainder)

		}catch(ex){
			resolve(ex);
		}
	})
}
function isValidBlank(value:number[], isIgnoreIsles = false){
	let response = true;

	Object.values(directions).forEach((coord:number[]) => {
		if(boardClass.value[value[0]+coord[0]] == undefined) return;

		const neighboringSquare = boardClass.value[value[0]+coord[0]][value[1]+coord[1]];
		if(neighboringSquare== undefined) return;
		if(neighboringSquare.visited) return;
		if(neighboringSquare.wall) return;
		if(board.value[value[0]+coord[0]][value[1]+coord[1]] == "  ") return;
		if(isIgnoreIsles && board.value[value[0]+coord[0]][value[1]+coord[1]] == " ●") return;

		response = false;
		return 0;
	});

	return response;
}

function reset(){
	ogboard.forEach((row:any,indexX:number) => {
		row.forEach((column:any, indexY:number) =>{
			if([" ●", " ■"].includes(column)){
				ogboard[indexX][indexY] = "  "
			}
		});
	});
	board.value = [...ogboard];
	move.value = [];

	boardZoom.value = minZoom.value;
	timerval1.value=0;
	timerRunning = false;
	clearInterval(interval1);
}

async function validateBoard(){
	let wallCount = 0;
	let root:number[] = [];

	board.value.forEach((row:any, x:number) => {
		row.forEach((column:any, y:number) =>{
			if(column != " ■") return;
			wallCount++;
			if(root.length==0) root = [x,y]
		});
	});
	if(boardSize !== wallCount+totalClue) return;

	// console.log('validating...')
	let result:any = false;

	// console.log('checkHas1Wall')
	result = await checkHas1Wall(root);
	clearHighlight()
	// console.log(result)
	if(! result) return

	// console.log('checkFor2By2')
	result = await checkFor2By2()
	// clearHighlight()
	// console.log(result)
	if(! result) return

	// clearHighlight()
	// console.log('checkHintsSatified')
	result = await checkHintsSatified()
	clearHighlight()
	// console.log(result)
	if(! result) return


	$("#gameboard").addClass('won');
	$('#btnUndo').prop('disabled', true);
	$('#btnRedo').prop('disabled', true);
	$('#btnSave').prop('disabled', true);
	$('#btnLoad').prop('disabled', true);
	$('#rangeZoom').prop('disabled', true);
	boardZoom.value = minZoom.value;

	timerRunning = false;
	clearInterval(interval1);
	// alert("You WON!");
	$("#exampleModal").modal('show')
	// console.log("You Won");

	recordWin();
}

function checkHas1Wall(square:number[]){
	return new Promise(async(resolve)=>{
		const queue = [square];
		let qString:string[] = [];

		for (let i = 0; i < queue.length; i++) {
			const value = queue[i];
			boardClass.value[value[0]][value[1]].visited = true;
			// boardClass.value[value[0]][value[1]].wall_highlighted = true;
			let neighboringSquare = [];


			Object.values(directions).forEach((coord) => {
				const newCoord = [value[0]+coord[0],value[1]+coord[1]];
				if(qString.includes(newCoord.toString())) return;

				if(boardClass.value[value[0]+coord[0]] == undefined) return;
				neighboringSquare = boardClass.value[value[0]+coord[0]][value[1]+coord[1]];
				if(neighboringSquare== undefined) return;
				if(neighboringSquare.visited) return
				if(!neighboringSquare.wall) return;

				queue.push(newCoord)
				qString.push(newCoord.toString());
			});
		}
		resolve((queue.length === boardSize-totalClue))
	})
}
function checkFor2By2(){
	return new Promise((resolve)=>{
		for (let i = 0; i < board.value.length - 1; i++) {
			for (let j = 0; j < board.value[i].length - 1; j++) {
				const cell1 = board.value[i][j];
				const cell2 = board.value[i][j + 1];
				const cell3 = board.value[i + 1][j];
				const cell4 = board.value[i + 1][j + 1];

				if ([cell1, cell2, cell3, cell4].every(cell => cell==" ■")) {
					resolve(false);
				}
			}
		}
		resolve(true);
	})
}
function checkHintsSatified(){
	return new Promise(async (resolve)=>{
		let ctr:number=0;
		for (let index = 0; index < hints.length; index++) {
			const element = hints[index];
			ctr = await highlightIsland(element, true)

			if(ctr==0) continue;

			resolve(false);
			return;
		}
		resolve(ctr==0)
	})
}

function getTimezoneOffset():string{
	let offset = (new Date).getTimezoneOffset();
	let sign = offset<0?'+':'-';
	let hour = ('0'+Math.abs(offset/60)).slice(-2);
	let minute = ('0'+offset%60).slice(-2);
	return `${sign}${hour}:${minute}`;
}

async function findPuzzleByDate(){
	let slashDate = date.value.getFullYear()+"/"+
		(date.value.getMonth()+1)+"/"+
		date.value.getDate();
	dateFilter.value = slashDate;

	const loader = $loading.show();
	try {
		const v = await axios.post(
			"/fetchapi",
			{
				difficulty: difficulty.value,
				date: slashDate,
			}
		)

		if(v.data == ""){
			throw "No record found";
		}

		isOpenFilter.value=false;

		move.value = [];

		const data = v.data.puzzleData;
		// const h = data.gridHeight;
		const w = data.gridWidth;
		const g = data.data.startingGrid;

		ogboard =[[]]

		//change url without
		let urlPath = `/board/${difficulty.value}/${dateFilter.value}`;
		window.history.pushState({},"", urlPath);


		// update scale
		// const sqrSize = $('#nurikabe').css('--sqr_size').slice(0,-2);;
		let boardWidth = $('#wrap_board').css('width'); // get board width
		boardWidth = boardWidth.slice(0,-2); // remove the unit PX
		// let boardWrapWidth = sqrSize * 1.7 * w;
		// const boardScale = boardWidth/boardWrapWidth;
		// console.log(boardScale.toFixed(2))
		// $('#gameboard').css('transform', 'scale('+boardScale+')');

		let zoom = ((boardWidth - 16)/w)/1.8;
		zoom = Math.min(zoom, 30);
		zoom = parseFloat(zoom.toFixed(1))
		minZoom.value = zoom;
		$('#nurikabe').css('--col_count', w);

		Object.entries(g).forEach(([k,v]) => {
			const x = parseInt(k/w);
			const y = k%w;
			if(ogboard[x] == undefined) ogboard[x] = [];

			if(v == 0){
				ogboard[x][y]= "  ";
			}else{
				ogboard[x][y]= " "+v;
			}
		});
		board.value = ogboard;

		// maxZoom.value = zoom*2
		// boardZoom.value = zoom;

		timerval1.value=0;
		timerRunning = false;
		clearInterval(interval1);
	} catch (err) {
		console.log(err);
		alert(`API Error: Fetching board failed. `);
	} finally {
		// loading.value = false;
		loader.hide();
	}
}

function redo(){
	// console.log('redo')
	const cell:number[] = move_r.value.pop()??[];
	if(cell.length==0) return;
	move.value.push(cell);
	setSquare(cell[0], cell[1], 'up');
}
function undo(){
	// console.log('undo')
	const cell:number[] = move.value.pop()??[];
	if(cell.length==0) return;
	move_r.value.push(cell);
	setSquare(cell[0], cell[1], 'down');
}
function autofill(){
	let corners = {
		'tl':[-1,-1],
		'tr':[-1, 1],
		'bl':[ 1,-1],
		'br':[ 1, 1],
	};
	let directions2 = {
		"left"	:[ 0,-2],
		"top"	:[-2, 0],
		"right"	:[ 0, 2],
		"bottom":[ 2, 0],
	};

	hints.forEach(element => {
		const value = board.value[element[0]][element[1]];
		// console.log(value);
		if(value==1){
			Object.values(directions).forEach(direction => {
				if(board.value[element[0]+direction[0]] == undefined) return;
				if(board.value[element[0]+direction[0]][element[1]+direction[1]] == undefined) return;
				board.value[element[0]+direction[0]][element[1]+direction[1]]= " ■";
				boardClass.value[element[0]+direction[0]][element[1]+direction[1]].wall = true;
			});
			return
		}
		Object.values(corners).forEach(corner => {
			if(board.value[element[0]+corner[0]] == undefined) return;
			if(board.value[element[0]+corner[0]][element[1]+corner[1]] == undefined) return;

			const cell = board.value[element[0]+corner[0]][element[1]+corner[1]];
			if(!isNumber(cell)) return;

			if(typeof board.value[element[0]+corner[0]][element[1]] != undefined){
				board.value[element[0]+corner[0]][element[1]] = " ■";
				boardClass.value[element[0]+corner[0]][element[1]].wall = true;
			}
			if(typeof board.value[element[0]][element[1]+corner[1]] != undefined){
				board.value[element[0]][element[1]+corner[1]] = " ■";
				boardClass.value[element[0]][element[1]+corner[1]].wall = true;
			}
		});
		Object.entries(directions2).forEach(([direction,coord]) => {
			if(board.value[element[0]+coord[0]] == undefined) return;
			if(board.value[element[0]+coord[0]][element[1]+coord[1]] == undefined) return;

			const cell = board.value[element[0]+coord[0]][element[1]+coord[1]];
			if(!isNumber(cell)) return;

			if(typeof board.value[element[0]+directions[direction][0]] == undefined) return;
			if(typeof board.value[element[0]+directions[direction][0]][element[1]+directions[direction][1]] == undefined) return;

			board.value[element[0]+directions[direction][0]][element[1]+directions[direction][1]]= " ■";
			boardClass.value[element[0]+directions[direction][0]][element[1]+directions[direction][1]].wall = true;
		});


	});
}
function randomFetch(){
	// 2005 to present
	let minYr = 2005;

	let the_difficulty = Math.floor(Math.random() * 3);
	let difficulties = ['small', 'medium', 'large'];

	let maxYr;
	let year;
	let month;
	let day;
	let the_date;

	maxYr = new Date().getFullYear();
	year = Math.floor(Math.random() * (maxYr-minYr+1))+minYr;
	month = (Math.floor(Math.random() * 12)+1).toString().padStart(2, '0');
	day = (Math.floor(Math.random() * 2)+30).toString().padStart(2, '0');
	the_date = new Date(`${year}/${month}/${day}`);

	difficulty.value = difficulties[the_difficulty]
	date.value = the_date

	findPuzzleByDate()
}
async function recordWin(){

	const winDate = date.value.getFullYear()+ '-'+
		('0'+(date.value.getMonth()+1)).slice(-2)+ '-'+
		('0'+date.value.getDate()).slice(-2)
	let formData ={
		difficulty: difficulty.value,
		date: winDate,
		time: timerval1.value
	}

	// console.log(formData);return;

	try {
		const v = await axios.post(
			"/history/recordWin",
			formData
		)
		// console.log(v.data)
	} catch (err) {
		console.log(err);
	} finally {
		// loading.value = false;
	}

}
function focusPage(){
	// Code to execute when the tab gains focus
	// console.log('Tab is now focused');
	if(timerRunning){
		interval1 = setInterval(()=>{timerval1.value++}, 1000);
	}
}
function unfocusPage(){
	// Code to execute when the tab loses focus
	// console.log('Tab is now blurred');
	clearInterval(interval1);
}
function scrollZoom(ev){
	if($("#gameboard").hasClass('won')) return;

	if(ev.deltaY>0 && minZoom.value < boardZoom.value){
		boardZoom.value-=2;
		boardZoom.value = Math.max(minZoom.value, boardZoom.value)
	}else if(ev.deltaY<0 && boardZoom.value < maxZoom.value){
		boardZoom.value+=2;
		boardZoom.value = Math.min(boardZoom.value,maxZoom.value)
	}
}

// ++++++UTIL

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
function isNumber(value:any) {
	return !isNaN(parseFloat(value)) && isFinite(value);
}
// ------UTIL

// ++++++PINCH

// Global vars to cache event state
const evCache = [];
let prevDiff = 100000;
let prevCoord = [100000,100000];
// Install event handlers for the pointer target
let el;


function pointerdownHandler(ev) {
	// The pointerdown event signals the start of a touch interaction.
	// This event is cached to support 2-finger gestures
	evCache.push(ev);
}
function pointermoveHandler(ev) {
	// This function implements a 2-pointer horizontal pinch/zoom gesture.
	//
	// If the distance between the two pointers has increased (zoom in),
	// the target element's background is changed to "pink" and if the
	// distance is decreasing (zoom out), the color is changed to "lightblue".
	//
	// This function sets the target element's border to "dashed" to visually
	// indicate the pointer's target received a move event.
	//   ev.target.style.border = "dashed";

	// Find this event in the cache and update its record with this event
	const index = evCache.findIndex(
		(cachedEv) => cachedEv.pointerId === ev.pointerId,
	);
	evCache[index] = ev;

  	// If two pointers are down, check for pinch gestures
	if (evCache.length === 2) {
		if($("#gameboard").hasClass('won')) return;

		// Calculate the distance between the two pointers
		const curDiff = Math.sqrt(Math.pow(evCache[0].clientX - evCache[1].clientX,2)+Math.pow(evCache[0].clientY - evCache[1].clientY,2));

		if(prevDiff !== 100000){
			// console.log(curDiff-prevDiff)
			let newZoom = parseFloat(boardZoom.value) + ((curDiff-prevDiff)/8);
			newZoom = Math.min(newZoom, maxZoom.value);
			newZoom = Math.max(minZoom.value, newZoom);
			boardZoom.value = newZoom.toFixed(1);
		}

		// Cache the distance for the next move event
		prevDiff = curDiff;
	}
	else if(evCache.length === 1){
		let xCoord = evCache[0].clientX;
		let yCoord = evCache[0].clientY;
		if(prevCoord[0] !== 100000){
			let xDiff = xCoord - prevCoord[0];
			let yDiff = yCoord - prevCoord[1];

			const boardWrapper = document.getElementById('wrap_board');
			const mainWrapper = document.querySelector('main');
			mainWrapper.scrollBy({top: -yDiff})
			boardWrapper?.scrollBy({left: -xDiff})
		}
		prevCoord[0] = xCoord;
		prevCoord[1] = yCoord;
	}
}
function pointerupHandler(ev) {
	// Remove this pointer from the cache and reset the target's
	// background and border

	// Remove this event from the target's cache
	const index = evCache.findIndex(
		(cachedEv) => cachedEv.pointerId === ev.pointerId,
	);
	evCache.splice(index, 1);

	//   ev.target.style.background = "white";
	//   ev.target.style.border = "1px solid black";

	// If the number of pointers down is less than two then reset diff tracker
	if (evCache.length < 2) {
		prevDiff = 100000;
	}
	if (evCache.length < 1) {
		prevCoord = [100000,100000];
	}
}

// ------PINCH ACTION


// import 'bootstrap/dist/css/bootstrap.min.css'
// import 'bootstrap-vue-next/dist/bootstrap-vue-next.css'

</script>
<!-- <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script> -->
<style lang='css' scoped>
@import url('bootstrap/dist/css/bootstrap.min.css');
/* @import url('bootstrap-vue-next/dist/bootstrap-vue-next.css'); */
/* @import url('bootstrap-vue/dist/bootstrap-vue.css'); */
@import url('./board.css');

</style>

<template >

	<Head title="Board" />

	<AppLayout :breadcrumbs="breadcrumbs"
		tabindex='0'
		@blur='unfocusPage()' @focus='focusPage()'
		@keyup.ctrl.z.exact='undo()'
		@keyup.ctrl.shift.z.exact='redo()' @keyup.ctrl.y.exact='redo()'
		@wheel.keyup.ctrl.stop.prevent="scrollZoom($event)"
	>
		<!-- style="max-width: calc(100vw + 300px);" -->
		<div id='nurikabe' class="flex h-full flex-1 flex-col gap-4 rounded-xl p-4"
			@click.exact='resetHighlighting()'
			ref="loadingContainer"
		>
			<!-- <input type='file' id='inputFile' value="F:\Porfolio\Nurikabe Solver\puzzles\puzzle001.csv">
			<input type='button' value='Submit' class="btn btn-primary" onclick="$('#inputFile').change()"> -->
			<select name='' id='ddlPuzzle' autocomplete="off" style='display: none;'>
				<option value=''>Select item</option>
				<!-- <?php foreach ($files1 as $key => $value) {
					if (in_array($value,array(".",".."))) continue;
					echo "<option>$value</option>";
				}?> -->
			</select>
			<details id='det_help'>
				<summary>Help</summary>
				<div class='det-content'>
					<ul>
						<li>Wall cells are full filled cell</li>
						<li>Hint cells are cell with a number.</li>
						<li>Island cells are cell with a dot.</li>
						<li>Click/tap a cell to fill a wall. Click/tap again to turn it to island. Click/tap again to return it to empty.</li>
						<li>HINT cell + rightclick/longpress = show possible move and count island size. </li>
						<li>WALL cell + rightclick/longpress = highlight contigous wall. </li>
						<li>Ctrl+Z = Undo</li>
						<li>Ctrl+Y or Ctrl+Shft+Z = Redo</li>
						<li>The first few walls are filled in.</li>

					</ul>
				</div>
			</details>
			<div id='wrap_gameactions' style="">
				<details id='det_api' :open='isOpenFilter' @toggle="isOpenFilter = $event.target.open;">
					<summary>
						API
						&nbsp;&nbsp;&nbsp;<div class="pill-filter" id="filter_difficulty" v-if="!isOpenFilter">
							Size: {{ difficulty }}
						</div>
						<div class="pill-filter" id="filter_date" v-if="!isOpenFilter">
							Date: {{ dateFilter }}
						</div>
					</summary>
					<div class='det-content'>
						<table id='tbl_filter' style="width:100%;">
							<tr>
								<td>
									Size <br>
									<div class="wrap_option">
										<label>
											<input type="radio" name="" value='small' v-model="difficulty">
											Small
										</label>
										<label>
											<input type="radio" name="" value='medium'  v-model="difficulty">
											Medium
										</label>
										<label>
											<input type="radio" name="" value='large'  v-model="difficulty">
											Large
										</label>

									</div>
								</td>
							</tr>
							<tr>
								<td>
									Date
									<VueDatePicker id='api_date' v-model="date" inline auto-apply :enable-time-picker="false"
										:dark="isDark" week-start="0"
									></VueDatePicker>
								</td>
							</tr>
						</table>
						<hr>
						<div>
							<button type='button' class='btn btn-primary' @click='findPuzzleByDate()' >Submit</button>
							<input type='button' value='Random' class='btn btn-primary' @click='randomFetch()' />
						</div>
					</div>
				</details>
				<div id='fullboardchange' style='margin: 1em auto; text-align: center;'>
					<button class='btn btn-success' @click='reset()'	 id="btnReset" disabled>reset</button>
					<button class='btn btn-success' @click='saveBoard()' id="btnSave" disabled>save board</button>
					<button class='btn btn-success' @click='loadBoard()' id="btnLoad" disabled>load board</button>
				</div>
				<div style="margin-bottom: .25em;">
					<div style='width: 20em; display:flex; margin:auto; align-items: center; justify-content: space-around;'>
						<div style='font-family: monospace; font-size: 1.5em;'>{{gameTimer}}</div>
						<div>
							<input type='button' id="btnUndo" class="btn btn-primary" value="<<" title='Undo' @click="undo()" disabled>
							<input type='button' id="btnRedo" class="btn btn-primary" value=">>" title='Redo' @click="redo()" disabled>
						</div>
					</div>
				</div>
				<input type="range" name="" id="rangeZoom" v-model='boardZoom' :min="minZoom" :max='maxZoom' step=".1" disabled style="width:100%;" >
			</div>
			<div>
				<div id="wrap_board">
					<table id='gameboard' class="won">
						<tr v-for='(_,x) in board.length' :key='x' class=''>
							<td v-for='(_, y) in board[x].length' :key='y' class='square'
								@click="setSquare(x, y)"
								@contextmenu="highlightEntity(x,y)"
								:class='boardClass[x][y]'
								:id="'item-'+x+'_'+y"
								>
								{{ board[x][y] }}
							</td>
						</tr>
					</table>
				</div>
				<!-- <div style="display: inline-block; width: 150px; vertical-align: top; padding:.5em;">
					<table id="tbl_moves">
						<thead>
							<tr>
								<th>Move</th>
								<th style='padding:.25em .75em;'>X</th>
								<th style='padding:.25em .75em;'>Y</th>
							</tr>
						</thead>
						<tbody style="max-height:300px;">
							<tr v-for='(_,x) in move' :key='x' class=''>
								<td>{{move.length -1 - x}}</td>
								<td>{{move[move.length -1 - x][0]}}</td>
								<td>{{move[move.length -1 - x][1]}}</td>
							</tr>
						</tbody>
					</table>
				</div> -->
				<!-- <div style="display: inline-block; width: 150px; vertical-align: top; padding:.5em;">
					<table id="tbl_moves">
						<tbody style="max-height:300px;">
							<tr v-for='(_,x) in boardClass.length' :key='x' class=''>
								<td v-for='(_, y) in boardClass[x].length' :key='y' class='square'
								>
									{{ boardClass[x][y].roothint }}
								</td>
							</tr>
						</tbody>
					</table>
				</div> -->
			</div>
			<!-- Modal -->
			<div class="modal fade" id="exampleModal" tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true"
				:data-bs-theme="isDark?'dark':'light'"
			>
				<div class="modal-dialog">
					<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title" id="exampleModalLabel">Congratulation</h5>
						<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
					</div>
					<div class="modal-body">
						You Won!
					</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
						<!-- <button type="button" class="btn btn-primary">Save changes</button> -->
					</div>
					</div>
				</div>
			</div>
		</div>
	</AppLayout>
</template>

