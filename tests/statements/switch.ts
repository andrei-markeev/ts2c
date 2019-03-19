function showMessage(message) {
    switch(message) {
        case 1:
            console.log("message 1");
            break;
        case 2:
            console.log("message 2");
            break;
        default:
            console.log("default message");
            break;
    }
}

showMessage(1);
showMessage(2);
showMessage(3);
showMessage(-1);

function isGood(number) {
    switch(number) {
        case 3:
            console.log("3 is a good number");
            break;
        case 7:
            console.log("7 is a good number");
            break;
    }
}

showMessage(1);
showMessage(7);

function howMuch(fruit) {
    switch(fruit) {
        case "banana":
            console.log("banana - 1 euro");
            break;
        case "apple":
            console.log("apple - 2 euro");
            break;
        default:
            console.log("not in stock");
            break;
    }
}

howMuch("test");
howMuch("apple");
howMuch("banana");

function onlyFish(request) {
    switch(request) {
        case "fish":
            console.log("FISH!");
    }
}

onlyFish("test");
onlyFish("fish");
onlyFish("apple");

function ask(n) {
    var output = '';
    switch (n) {
      case 0:
        output += 'So ';
      case 1:
        output += 'What ';
        output += 'Is ';
      case 2:
        output += 'Your ';
      case 3:
        output += 'Name';
      case 4:
        output += '?';
        console.log(output);
        break;
      case 5:
        output += '!';
        console.log(output);
        break;
      default:
        console.log('Please pick a number from 0 to 5!');
    }
}

ask(0);
ask(1);
ask(2);
ask(3);
ask(4);
ask(5);
ask(6);

function isExtinct(animal) {
    switch (animal) {
        case 'cow':
        case 'giraffe':
        case 'dog':
        case 'pig':
          console.log(animal, 'is not extinct.');
          break;
        case 'dinosaur':
        default:
          console.log(animal, 'is extinct.');
    }
}

isExtinct("pig");
isExtinct("giraffe");
isExtinct("dinosaur");
isExtinct("archeopterix");

