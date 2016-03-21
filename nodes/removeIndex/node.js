output = function() {
  $.db.removeIndex($.fieldName,
    function(err) {
    if(err) {
      output({error: err});
    } else {
      output({db: $.db});
    }
  });
};
