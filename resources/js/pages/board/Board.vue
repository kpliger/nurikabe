<script setup lang="ts">
import axios from 'axios';
import AppLayout from '@/layouts/AppLayout.vue';
import { SharedData, type BreadcrumbItem, type User } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/vue3';
import PlaceholderPattern from '../../components/PlaceholderPattern.vue';
import {onMounted, ref, watch, toRaw, useTemplateRef} from 'vue';

import {useLoading} from 'vue-loading-overlay'
import 'vue-loading-overlay/dist/css/index.css';

import VueDatePicker from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css'

const script = document.createElement('script');
script.type = 'module';
script.src = 'https://code.jquery.com/jquery-3.6.3.min.js';
script.integrity = 'sha256-pvPw+upLPUjgMXY0G+8O0xUf+/Im1MZjXxxgOcBQBXU=';
script.crossOrigin = 'anonymous'; // JS property, not HTML attribute
document.head.appendChild(script);


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


// const datePicker = ref();

// const props = defineProps({
// 	user:Object,
// })
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
const isOpenFilter = ref(true);

const gameTimer = ref("00:00");
const timerval1 = ref(0);
let timerRunning = false;
let interval1 = null;//setInterval(()=>{timerval1.value++}, 1000);

const isDarkMode = ref(false);

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


onMounted(()=>{
	date.value = new Date();

	let slashDate = date.value.toISOString();
	slashDate = slashDate.slice(0,10)
	slashDate = slashDate.replaceAll("-","/");
	dateFilter.value = slashDate;

	isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches;

	difficulty.value = 'small'
})

watch(board, (newBoard)=>{
	$("#gameboard").removeClass('won');
	clearBoard(newBoard)

})
watch(timerval1, (newVal)=>{
	let second =  String(newVal%60).padStart(2,'0');
	let minute =  String(parseInt(newVal/60)).padStart(2,'0');
	gameTimer.value = minute+":"+second;
})

clearBoard(board.value)

function saveBoard(){
    localStorage.setItem('board', JSON.stringify(board.value??[[' ']]));
}
function loadBoard(){
	board.value = JSON.parse(localStorage.getItem('board')??"[[ ]]");
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
				hint: isNumber(newBoard[indexX][indexY])
			}
			if(isNumber(newBoard[indexX][indexY])){
				hints.push([indexX,indexY])
			}

			if(isNumber(column)){
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
		return;
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
			if(!neighboringSquare.wall) return;

			queue.push([value[0]+coord[0],value[1]+coord[1]])
		});
	}
}
async function highlightIsland(square:number[], isIgnoreIsles = false) {
	return new Promise(async (resolve)=>{
		let queue = [square];
		let qString:string[] = [];
		const blankQueue:number[][] = [];
		let remainder = parseFloat(board.value[square[0]][square[1]]);
		let hintVal = remainder;

		//highlight the hint square and isle squares
		for (let i = 0; i < queue.length; i++) {
			const value = queue[i];
			boardClass.value[value[0]][value[1]].visited = true;
			boardClass.value[value[0]][value[1]]['island_highlighted'] = true;
			Object.values(directions).forEach((coord:number[]) => {
				if(boardClass.value[value[0]+coord[0]] == undefined) return; //edge
				const neighboringSquare = boardClass.value[value[0]+coord[0]][value[1]+coord[1]];

				const newCoord = [value[0]+coord[0],value[1]+coord[1]];
				if(qString.includes(newCoord.toString())) return;

				if(neighboringSquare== undefined) return;
				if(neighboringSquare.visited) return;
				if(neighboringSquare.wall) return;
				if(isNumber(board.value[value[0]+coord[0]][value[1]+coord[1]])) return;

				if(board.value[value[0]+coord[0]][value[1]+coord[1]]== "  " || isIgnoreIsles){
					boardClass.value[value[0]+coord[0]][value[1]+coord[1]].visited=true
					blankQueue.push([value[0]+coord[0],value[1]+coord[1]])
				}else{
					queue.push(newCoord)
					qString.push(newCoord.toString());
				}
			});

			remainder=remainder-1;
			// if(isIgnoreIsles) break;
			if(remainder==0) break;
		}

		$(`#item-${square[0]}_${square[1]}`).css('--count', "'"+(hintVal-remainder)+"'")
		boardClass.value[square[0]][square[1]].root_highlight = true;

		if(remainder == 0){
			resolve(0);
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

			Object.values(directions).forEach((coord:number[]) => {
				if(boardClass.value[value[0]+coord[0]] == undefined) return;

				const neighboringSquare = boardClass.value[value[0]+coord[0]][value[1]+coord[1]];
				if(neighboringSquare== undefined) return;
				if(neighboringSquare.visited) return;
				if(neighboringSquare.wall) return;
				if(isNumber(board.value[value[0]+coord[0]][value[1]+coord[1]])) return;

				if(value[2]==1) return;
				const r = value[2]-1

				queue.push([value[0]+coord[0],value[1]+coord[1], r])
			});
			spaceCtr++
		}
		remainder-=spaceCtr;
		resolve(remainder)
	})
}
function isNumber(value:any) {
	return !isNaN(parseFloat(value)) && isFinite(value);
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

	console.log('validating...')
	let result:any = false;

	// console.log('checkHas1Wall')
	result = await checkHas1Wall(root);
	// console.log(result)
	if(! result) return

	// console.log('checkFor2By2')
	result = await checkFor2By2()
	// console.log(result)
	if(! result) return

	// clearHighlight()
	// console.log('checkHintsSatified')
	result = await checkHintsSatified()
	// console.log(result)
	if(! result) return

	clearHighlight()
	alert("You WON!")

	$("#gameboard").addClass('won');
	// console.log("You Won");
	clearInterval(interval1);

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
			// console.log($(`#item-${element[0]}_${element[1]}`))

			if(ctr!==0){
				resolve(false);
				return;
			}
		}
		resolve(ctr==0)
	})
}
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
async function findPuzzleByDate(){
	let slashDate = date.value.toISOString();
	slashDate = slashDate.slice(0,10)
	slashDate = slashDate.replaceAll("-","/");
	dateFilter.value = slashDate;

	try {
		const loader = $loading.show();

		const v = await axios.post(
			"/fetchapi",
			{
				difficulty: difficulty.value,
				date: slashDate,
			}
		)
		loader.hide();
		isOpenFilter.value=false;

		move.value = [];

		const data = v.data.puzzleData;
		// const h = data.gridHeight;
		const w = data.gridWidth;
		const g = data.data.startingGrid;

		ogboard =[[]]

		let boardWidth = $('.wrap_board').css('width'); // get board width
		boardWidth = boardWidth.slice(0,-2); // remove the unit PX

		let cellSize = (boardWidth/w)/1.9;
		cellSize = Math.min(cellSize, 30);

		$('#nurikabe').css('--sqr_size', cellSize+'px');

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

		timerval1.value=0;
		timerRunning = false;
		clearInterval(interval1);
	} catch (err) {
		console.log(err);
	} finally {
		// loading.value = false;
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
	let validDate;

	maxYr = new Date().getFullYear();
	year = Math.floor(Math.random() * (maxYr-minYr+1))+minYr;
	month = (Math.floor(Math.random() * 12)+1).toString().padStart(2, '0');
	day = (Math.floor(Math.random() * 2)+30).toString().padStart(2, '0');
	the_date = new Date(`${year}/${month}/${day}`);

	// year = the_date.getFullYear();
	// month = (the_date.getMonth()+1).toString().padStart(2, '0');
	// day = (the_date.getDay()+1).toString().padStart(2, '0');
	// validDate = new Date(`${year}-${month}-${day}`);
	// console.log(validDate.toISOString())
	// validDate = the_date;

	difficulty.value = difficulties[the_difficulty]
	date.value = the_date

	findPuzzleByDate()
}
async function recordWin(){
	let formData ={
		difficulty: difficulty.value,
		date: date.value,
		time: timerval1.value
	}

	// console.log(formData);return;

	try {
		const v = await axios.post(
			"/history/recordWin",
			formData
		)
		console.log(v.data)
	} catch (err) {
		console.log(err);
	} finally {
		// loading.value = false;
	}

}

function focusPage(){
	// Code to execute when the tab gains focus
	console.log('Tab is now focused');
	if(timerRunning){
		interval1 = setInterval(()=>{timerval1.value++}, 1000);
	}
}
function unfocusPage(){
	// Code to execute when the tab loses focus
	console.log('Tab is now blurred');
	clearInterval(interval1);
}


</script>

<style lang='css' scoped>
@import url('bootstrap/dist/css/bootstrap.css');
@import url('./board.css');

</style>

<template >

	<Head title="Board" />

	<AppLayout :breadcrumbs="breadcrumbs" @blur='unfocusPage()' @focus='focusPage()'>
		<div id='nurikabe' class="flex h-full flex-1 flex-col gap-4 rounded-xl p-4"
			tabindex='0'
			@click.exact='resetHighlighting()' @keyup.ctrl.z.exact='undo()'
			@keyup.ctrl.shift.z.exact='redo()' @keyup.ctrl.y.exact='redo()'
			ref="loadingContainer"
		>
			<br>
			<div style="margin-bottom:1em;">
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
				<details id='det_api' :open='isOpenFilter' @toggle="isOpenFilter = $event.target.open;">
					<summary>
						API
						&nbsp;&nbsp;&nbsp;<div class="pill-filter" id="filter_difficulty" v-if="!isOpenFilter">
							Difficulty: {{ difficulty }}
						</div>
						<div class="pill-filter" id="filter_date" v-if="!isOpenFilter">
							Date: {{ dateFilter }}
						</div>
					</summary>
					<div class='det-content'>
						<table>
							<tr>
								<td>Difficulty</td>
								<td>
									<div>
										<label>
											<input type="radio" name="" value='small' v-model="difficulty">
											Small
										</label> |
										<label>
											<input type="radio" name="" value='medium'  v-model="difficulty">
											Medium
										</label> |
										<label>
											<input type="radio" name="" value='large'  v-model="difficulty">
											Large
										</label>

									</div>
								</td>
							</tr>
							<tr>
								<td style="vertical-align: top;">Date</td>
								<td>
  									<VueDatePicker id='api_date' v-model="date" inline auto-apply :enable-time-picker="false"
									  :dark="isDarkMode"
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

			</div>

			<div id='fullboardchange' style='margin:auto;'>
				<button class='btn btn-success' @click='reset()'>reset</button>
				<button class='btn btn-success' @click='saveBoard()'>save board</button>
				<button class='btn btn-success' @click='loadBoard()'>load board</button>
			</div>
			<div style="margin-bottom: .25em;">
				<div style='width: 20em; display:flex; margin:auto; align-items: center; justify-content: space-around;'>
					<div style='font-family: monospace; font-size: 1.5em;'>{{gameTimer}}</div>
					<div>
						<input type='button' id="btnUndo" class="btn btn-primary" value="<<" title='Undo' @click="undo()">
						<input type='button' id="btnRedo" class="btn btn-primary" value=">>" title='Redo' @click="redo()">
					</div>
				</div>
			</div>
			<div>
				<div class="wrap_board">
					<table id='gameboard'>
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
			</div>
		</div>
	</AppLayout>
</template>

